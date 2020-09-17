import React from 'react';

function smoothScroll(element) {
  document.getElementById(element).scrollIntoView({ behavior: 'smooth' });
}

const Header = () => {
  return (
    <header>
      <div>
        <img id='logo-main' src='../images/quell_logos/QUELL-long.svg'></img>
      </div>

      <ul className='header-links'>
        <li>
          <a href='#info'>INFO</a>
        </li>
        <li>
          <a href='#demo'>DEMO</a>
        </li>
        <li>
          <a href='#team'>TEAM</a>
        </li>
        <li>
          <a href='https://github.com/oslabs-beta/Quell' target='_blank'>
            GITHUB
          </a>
        </li>
      </ul>
    </header>
  );
};

export default Header;
