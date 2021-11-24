import React, { Component } from 'react';
import ReactDOM, { render } from 'react-dom';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  render() {
    return(
      <div>test</div>
    );
  }
}

render(<App />, document.getElementById('root'));