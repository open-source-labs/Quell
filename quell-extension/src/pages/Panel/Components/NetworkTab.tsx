import React, { useState, useEffect, useMemo, cloneElement } from 'react';
import { useTable } from 'react-table';
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
import NavButton from './NavButton';
import { getResponseStatus } from '../helpers/getResponseStatus';
import { getOperationNames } from '../helpers/parseQuery';

const NetworkTab = ({ graphQLRoute, clientAddress, clientRequests } = props) => {
  const [clickedRowData, setClickedRowData] = useState({});
  const [activeRow, setActiveRow] = useState<number>(-1);

  useEffect(() => {
    console.log('Clicked Row Data: ', clickedRowData);
  }, [clientRequests, clickedRowData]);

  return (
    <div className='networkTab'>
      <div className='title_bar'>
        Client Quell Requests
      </div>
      <div id="network-page-container">
        <SplitPane
          style={{ maxWidth: '100%', maxHeight: '300px'}}
          split="vertical"
          minSize={450}
          defaultSize={800}
        >
          <div id="network-request-table">
            <NetworkRequestTable
              className='networkTable'
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
              style={{ marginTop: '-6px', marginLeft: '20px' }}
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
                    : [0]
                }
              />
            </div>
          )}
        </SplitPane>
      </div>
    </div>
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

        < NavButton 
          text={'request'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          altText={'Request Headers'}
          altClass={'networkNavButton'}
        />

        < NavButton 
          text={'response'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          altText={'Response Headers'}
          altClass={'networkNavButton'}
        />

        < NavButton 
          text={'data'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          altText={'Response Data'}
          altClass={'networkNavButton'}
        />

      </div>
      <div className="headersBox" style={activeTab === 'data' ? {height:'0px'}:{}}>
        {activeTab === 'request' && (
          <>
            {/* <div className="networkTitle">Request Headers</div> */}
            {clickedRowData.request.headers.map((header, index) => (
              <p key={`req-header-${index}`}>
                <b>{header.name}</b>: {header.value}
              </p>
            ))}
          </>
        )}
        {activeTab === 'response' && (
          <>
            {/* <div className="networkTitle">Response Headers</div> */}
            {clickedRowData.response.headers.map((header, index) => (
              <p key={`res-header-${index}`}>
                <b>{header.name}</b>: {header.value}
              </p>
            ))}
          </>
        )}
      </div>
      {activeTab === 'data' && (
        <>
          <CodeMirror
            className='network_editor'
            value={beautify(clickedRowData.responseData, null, 2, 80)}
            options={{
              theme: 'material-darker',
              mode: 'json',
              scrollbarStyle: 'null',
            }}
          />
        </>
      )}
      
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
        id: 'number',
        Header: '#',
        accessor: (row, index) => index + 1,
      },
      {
        // maybe instead of query type, use `graphql-tag` to display name of queried table/document
        id: 'query-type',
        Header: 'Operation Type(s)',
        // accessor: (row) => Object.keys(JSON.parse(row.request.postData.text)),
        accessor: row => getOperationNames(row)
      },
      {
        id: 'url',
        Header: 'URL',
        accessor: (row) => row.request.url,
      },
      {
        id: 'status',
        Header: 'Status',
        accessor: (row) => getResponseStatus(row),
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

  // React Table suggests memoizing table data as best practice, to reduce computation
  // in populating table, but this prevents live updating on new client requests
  // const data = useMemo(() => [...clientRequests], []);
  const data = clientRequests;

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data });

  return (
    <>
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

export default NetworkTab;