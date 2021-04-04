import React from 'react';
import GraphiQL from 'graphiql';
import 'graphiql/graphiql.min.css';

const Graphiql = () => (
  <GraphiQL
    fetcher={async (graphQLParams) => {
      const data = await fetch(
        'graphql',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(graphQLParams),
          credentials: 'same-origin',
        }
      );
      return data.json().catch(() => data.text());
    }}
  />
);

export default Graphiql;
