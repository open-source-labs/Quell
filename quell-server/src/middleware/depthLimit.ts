import { Request, Response, NextFunction } from "express";
import { DocumentNode, parse } from "graphql";
import { parseAST, updateProtoWithFragment } from "../helpers/quellHelpers";
import type { ProtoObjType, FragsType, ServerErrorType } from "../types/types";

export interface DepthLimitConfig {
  maxDepth: number;
}

/**
 * Takes in the query, parses it, and identifies the general shape of the request in order
 * to compare the query's depth to the depth limit set on server connection.
 *
 * In the instance of a malicious or overly nested query, short-circuits the query before
 * it goes to the database and passes an error with a status code 413 (content too large).
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void} Passes an error to Express if no query was included in the request or if the depth exceeds the maximum allowed depth.
 */
// what parameters should they take? If middleware, good as is, has to take in query obj in request, limit set inside.
// If function inside whole of Quell, (query, limit), so they are explicitly defined and passed in
export function createDepthLimit(config: DepthLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get maximum depth limit from the cost parameters set on server connection.
    let { maxDepth } = config;

    // Get the GraphQL query string from request body.
    const queryString: string | undefined = req.body.query;

    // Pass error to Express if no query is found on the request.
    if (!queryString) {
      {
        const err: ServerErrorType = {
          log: "Invalid request, no query found in req.body",
          status: 400,
          message: {
            err: "Error in middleware function: depthLimit. Check server log for more details.",
          },
        };
        return next(err);
      }
    }

    // Create the abstract syntax tree with graphql-js parser.
    // If costLimit was included before depthLimit in middleware chain, we can get the AST and parsed AST from res.locals.
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

    /**
     * Recursive helper function that determines if the depth of the prototype object
     * is greater than the maxDepth.
     * @param {Object} proto - The prototype object to determine the depth of.
     * @param {number} [currentDepth=0] - The current depth of the object. Defaults to 0.
     * @returns {void} Passes an error to Express if the depth of the prototype exceeds the maxDepth.
     */
    const determineDepth = (proto: ProtoObjType, currentDepth = 0): void => {
      if (currentDepth > maxDepth) {
        // Pass error to Express if the maximum depth has been exceeded.
        const err: ServerErrorType = {
          log: "Error in QuellCache.determineDepth: depth limit exceeded.",
          status: 413, // Content Too Large
          message: {
            err: `Depth limit exceeded, tried to send query with the depth of ${currentDepth}.`,
          },
        };
        res.locals.queryErr = err;
        return next(err);
      }

      // Loop through the fields, recursing and increasing currentDepth by 1 if the field is nested.
      Object.keys(proto).forEach((key) => {
        if (typeof proto[key] === "object" && !key.includes("__")) {
          determineDepth(proto[key] as ProtoObjType, currentDepth + 1);
        }
      });
    };

    // Call the helper function.
    determineDepth(prototype);
    // Attach the AST and parsed AST to res.locals so that the next middleware doesn't need to determine these again.
    res.locals.AST = AST;
    res.locals.parsedAST = { proto, operationType, frags };
    return next();
  };
}
