import React, { useState, useEffect, useMemo, cloneElement } from 'react';
import { useRowState, useTable } from 'react-table';
import Metrics from './Metrics';
import SplitPane from 'react-split-pane';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';
import 'codemirror/theme/xq-light.css';
import 'codemirror';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/hint/show-hint';
import 'codemirror-graphql/lint';
import 'codemirror-graphql/hint';
import 'codemirror-graphql/mode';
import beautify from 'json-beautify';

const Network = ({ graphQLRoute, clientAddress, clientRequests } = props) => {
  const [clickedRowData, setClickedRowData] = useState({});
  const [activeRow, setActiveRow] = useState<number>(-1);

  useEffect(() => {
    console.log('CRs: ', clientRequests);
    console.log('Clicked Row Data: ', clickedRowData);
  }, [clientRequests, clickedRowData]);

  return (
    <React.Fragment>
      <div style={{ fontSize: '1.25rem', fontWeight: 'bolder' }}>
        Client Quell Requests
      </div>
      <div style={{ fontSize: '.75rem' }}>
        Total Client Requests: {clientRequests.length}
      </div>
      <div id="network-page-container">
        <SplitPane
          style={{ maxWidth: '100%' }}
          split="vertical"
          minSize={450}
          defaultSize={800}
        >
          <div id="network-request-table">
            <NetworkRequestTable
              clientRequests={clientRequests}
              setClickedRowData={setClickedRowData}
              setActiveRow={setActiveRow}
              activeRow={activeRow}
            />
          </div>
          {activeRow > -1 ? (
            <RequestDetails
              clickedRowData={clickedRowData}
            />
          ) : (
            <div
              id="network-request-metrics"
              style={{ marginTop: '-9px', marginLeft: '20px' }}
            >
              <Metrics
                fetchTime={
                  clientRequests.length > 0
                    ? clientRequests[clientRequests.length - 1].time.toFixed(2)
                    : 0
                }
                fetchTimeInt={
                  clientRequests.length > 0
                    ? clientRequests.map((request) => request.time)
                    : 0
                }
              />
            </div>
          )}
        </SplitPane>
      </div>
    </React.Fragment>
  );
};

const RequestDetails = ({ clickedRowData } = props) => {
  const [activeTab, setActiveTab] = useState<string>('request');
  const activeStyle = {
    backgroundColor: '#444',
    color: '#bbb',
  };
  return (
    <div id="queryExtras">
      <div className="networkNavBar">
        <button
          className="networkNavbutton"
          style={activeTab === 'request' ? activeStyle : {}}
          onClick={() => setActiveTab('request')}
        >
          Request Headers
        </button>

        <button
          className="networkNavbutton"
          style={activeTab === 'response' ? activeStyle : {}}
          onClick={() => setActiveTab('response')}
        >
          Response Headers
        </button>

        <button
          className="networkNavbutton"
          style={activeTab === 'table' ? activeStyle : {}}
          onClick={() => setActiveTab('data')}
        >
          Response Data
        </button>
      </div>
      <div className="headersBox">
        {activeTab === 'request' && (
          <>
            <div className="networkTitle">Request Headers</div>
            {clickedRowData.request.headers.map((header, index) => (
              <p key={`req-header-${index}`}>
                <b>{header.name}</b>: {header.value}
              </p>
            ))}
          </>
        )}
        {activeTab === 'response' && (
          <>
            <div className="networkTitle">Response Headers</div>
            {clickedRowData.response.headers.map((header, index) => (
              <p key={`res-header-${index}`}>
                <b>{header.name}</b>: {header.value}
              </p>
            ))}
          </>
        )}
        {activeTab === 'data' && (
          <>
            <div className="networkTitle">Response Data</div>
            {/* {responseData} */}
            <CodeMirror
              value={beautify(clickedRowData.responseData, null, 2, 80)}
              options={{
                theme: 'material-darker',
                mode: 'json',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

const NetworkRequestTable = ({
  clientRequests,
  setClickedRowData,
  setActiveRow,
  activeRow,
} = props) => {
  const handleRowClick = (cell) => {
    // const { request.headers, response.headers } = cell.row.original;
    setClickedRowData(cell.row.original);
  };

  const columns = useMemo(
    () => [
      {
        // maybe instead of query type, use `graphql-tag` to display name of queried table/document
        id: 'query-type',
        Header: 'Query Type',
        accessor: (row) => Object.keys(JSON.parse(row.request.postData.text)),
      },
      {
        id: 'url',
        Header: 'URL',
        accessor: (row) => row.request.url,
      },
      {
        id: 'status',
        Header: 'Status',
        accessor: (row) => row.response.status,
      },
      {
        id: 'size',
        Header: 'Size (kB)',
        accessor: (row) => (row.response.content.size / 1000).toFixed(2),
      },
      {
        id: 'time',
        Header: 'Time (ms)',
        accessor: (row) => row.time.toFixed(2),
      },
    ],
    []
  );

  const data = useMemo(() => [...clientRequests], []);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data });

  return (
    <>
      {/* <div>
     {clientRequests.map((req, index) => <NetworkRequest key={index} req={req} index={index} />)}
   </div> */}
      <div id="dataTable_container">
        <table {...getTableProps()}>
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column) => (
                  <th {...column.getHeaderProps()}>
                    {column.render('Header')}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map((row) => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map((cell) => {
                    return (
                      <td
                        style={
                          activeRow === cell.row.id
                            ? { backgroundColor: '#444' }
                            : {}
                        }
                        {...cell.getCellProps()}
                        onClick={() => {
                          console.log(cell.row.id);
                          if (activeRow !== cell.row.id)
                            setActiveRow(cell.row.id);
                          else setActiveRow(-1);
                          handleRowClick(cell);
                        }}
                      >
                        <center>{cell.render('Cell')}</center>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Network;
