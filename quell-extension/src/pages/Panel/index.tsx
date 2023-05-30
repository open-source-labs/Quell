require('file-loader?name=[name].[ext]!./index.html');
import ReactDOM from 'react-dom';
import App from './App';
import './global.scss';
import 'reactflow/dist/style.css';

ReactDOM.render(
  <App />,
  document.getElementById('app')
);
