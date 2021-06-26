import React from 'react';
import Header from './Header.jsx';
import Info from './Info.jsx';
import Demo from './Demo.jsx';
import Team from './Team.jsx';
import Footer from './Footer.jsx';
import Graphiql from './Graphiql.jsx';

const Main = () => {
  return (
    <div className="main">
      <Header />
      <Info />
      <Demo />
      {/* <Graphiql /> */}
      <Team />
      <Footer />
    </div>
  );
};

export default Main;
