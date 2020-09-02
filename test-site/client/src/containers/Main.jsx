import React from 'react';
import Header from '../components/Header.jsx'
import GetAll from '../components/GetAll.jsx'
import GetSome from '../components/GetSome.jsx'
import Footer from '../components/Footer.jsx'

const Main = () => {
  return(
    <div className="main">
      <Header />
      <GetAll />
      <GetSome />
      <Footer />
    </div>
  )
}

export default Main;