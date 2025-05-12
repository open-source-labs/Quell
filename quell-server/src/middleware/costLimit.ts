import { Request, Response, NextFunction } from "express";
import { DocumentNode, parse } from "graphql";
import { parseAST, updateProtoWithFragment } from "../helpers/quellHelpers";
import type {
  ProtoObjType,
  FragsType,
  ServerErrorType,
  CostParamsType,
} from "../types/types";

export interface CostLimitConfig {
  costParameters: CostParamsType;
  schema?: any; // Optional if you need schema access
}

/**
 * Checks the cost of the query. In the instance of a malicious or overly nested query,
 * short-circuits the query before it goes to the database and passes an error with a
 * status code 413 (content too large).
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void} Passes an error to Express if no query was included in the request or if the cost exceeds the maximum allowed cost.
 */

export function createCostLimit(config: CostLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get the cost parameters from config
    const { maxCost, mutationCost, objectCost, depthCostFactor, scalarCost } =
      config.costParameters;

    // Get the GraphQL query string from request body.
    const queryString: string | undefined = req.body.query;

    // Pass error to Express if no query is found on the request.
    if (!queryString) {
      const err: ServerErrorType = {
        log: "Invalid request, no query found in req.body",
        status: 400,
        message: {
          err: "Error in QuellCache.costLimit. Check server log for more details.",
        },
      };
      return next(err);
    }

    // Create the abstract syntax tree with graphql-js parser.
    // If depthLimit was included before costLimit in middleware chain, we can get the AST and parsed AST from res.locals.
    const AST: DocumentNode = res.locals.AST
      ? res.locals.AST
      : parse(queryString);

    // Create response prototype, operation type, and fragments object.
    // The response prototype is used as a template for most operations in Quell including caching, building modified requests, and more.
    const {
      proto,
      operationType,
      frags,
    }: { proto: ProtoObjType; operationType: string; frags: FragsType } =
      res.locals.parsedAST ?? parseAST(AST);

    // Combine fragments on prototype so we can access fragment values in cache.
    const prototype =
      Object.keys(frags).length > 0
        ? updateProtoWithFragment(proto, frags)
        : proto;

    // Set initial cost to 0.
    // If the operation is a mutation, add to the cost the mutation cost multiplied by the number of mutations.
    let cost = 0;
    if (operationType === "mutation") {
      cost += Object.keys(prototype).length * mutationCost;
    }

    /**
     * Helper function to pass an error if the cost of the proto is greater than the maximum cost set on server connection.
     * @param {Object} proto - The prototype object to determine the cost of.
     * @returns {void} Passes an error to Express if the cost of the prototype exceeds the maxCost.
     */
    const determineCost = (proto: ProtoObjType): void => {
      // Pass error to Express if the maximum cost has been exceeded.
      if (cost > maxCost) {
        const err: ServerErrorType = {
          log: "Error in costLimit.determineCost(helper): cost limit exceeded.",
          status: 413, // Content Too Large
          message: {
            err: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
          },
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // Loop through the fields on the prototype.
      Object.keys(proto).forEach((key) => {
        if (typeof proto[key] === "object" && !key.includes("__")) {
          // If the current field is nested, recurse and increase the total cost by objectCost.
          cost += objectCost;
          return determineCost(proto[key] as ProtoObjType);
        }
        // If the current field is scalar, increase the total cost by the scalarCost.
        if (proto[key] === true && !key.includes("__")) {
          cost += scalarCost;
        }
      });
    };

    determineCost(prototype);

    /**
     * Helper function to pass an error if the cost of the proto, taking into account depth levels, is greater than
     * the maximum cost set on server connection.
     *
     * This function essentially multiplies the cost by a depth cost adjustment, which is equal to the
     * depthCostFactor raised to the power of the depth.
     * @param {Object} proto - The prototype object to determine the cost of.
     * @param {number} totalCost - Current cost of the prototype.
     * @returns {void} Passes an error to Express if the cost of the prototype exceeds the maxCost.
     */
    const determineDepthCost = (
      proto: ProtoObjType,
      totalCost = cost
    ): void => {
      // Pass error to Express if the maximum cost has been exceeded.
      if (totalCost > maxCost) {
        const err: ServerErrorType = {
          log: "Error in costLimit.determineDepthCost(helper): cost limit exceeded.",
          status: 413, // Content Too Large
          message: {
            err: `Cost limit exceeded, tried to send query with a cost exceeding ${maxCost}.`,
          },
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // Loop through the fields, recursing and multiplying the current total cost
      // by the depthCostFactor if the field is nested.
      Object.keys(proto).forEach((key) => {
        if (typeof proto[key] === "object" && !key.includes("__")) {
          determineDepthCost(
            proto[key] as ProtoObjType,
            totalCost * depthCostFactor
          );
        }
      });
    };

    determineDepthCost(prototype);

    // Attach the AST and parsed AST to res.locals so that the next middleware doesn't need to determine these again.
    res.locals.AST = AST;
    res.locals.parsedAST = { proto, operationType, frags };
    return next();
  };
}
