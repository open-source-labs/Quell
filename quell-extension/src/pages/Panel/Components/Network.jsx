import React, { useState, useEffect } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import beautify from 'json-beautify';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';
import 'codemirror/theme/xq-light.css';

const Network = ({ graphQLRoute, clientAddress, clientRequests } = props) => {
  const requests = [];
  
  return(
        <React.Fragment>
          <h2>Client Quell Requests</h2>
          <div id="network-page">
            {clientRequests.map((value, index) => <NetworkRequest key={index} value={value} index={index} />)}
          </div>
        </React.Fragment>
        )
  
//   useEffect(() => {
//     console.log('CRs: ', clientRequests)
     
//     console.log('requests: ', requests)
//   }, [clientRequests]);
  
  // return (
  //   <div id="network-page">
  //     <Typography variant="h6" align="center">
  //       Client-Side Quell Requests
  //     </Typography>
  //     {clientRequests.forEach((req, i) => {
  //   <NetworkRequest id={i} reqNum={req} />
  // })}
  //     <br/> Client Requests: {clientRequests.length}
  //   </div>
  // );
};

const NetworkRequest = (props) => {

  const { index, value } = props;

  return (

    // <p id={index}>Name: {value.name} </p>

    <Accordion>
      <AccordionSummary>
        Request {index}
      </AccordionSummary>
      <AccordionDetails>
        Name: {value.name}
      </AccordionDetails>
    </Accordion>
  )

}


export default Network;
