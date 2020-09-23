import React from 'react';
import Header from './Header.jsx';
import Info from './Info.jsx';
import Demo from './Demo.jsx';
import Team from './Team.jsx';
import Footer from './Footer.jsx';

const Main = () => {
  return (
    <div className='main'>
      <Header />
      <Info />
      <Demo />
      <Team />
      <Footer />
    </div>
  );
};

export default Main;
