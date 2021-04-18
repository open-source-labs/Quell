import React from 'react';
import TeamMember from '../components/TeamMember.jsx';
import Header from '../images/headers/QUELL-team quell-2color_1.svg';
import Nick from '../images/profile_pics/QUELL-headshot w border-Nick.svg';
import Mike from '../images/profile_pics/QUELL-headshot w border-Mike.svg';
import Rob from '../images/profile_pics/QUELL-headshot w border-Rob.svg';
import Justin from '../images/profile_pics/QUELL-headshot w border-Justin.svg';
import Andrei from '../images/profile_pics/QUELL-headshot w border-Andrei.png';
import Dasha from '../images/profile_pics/QUELL-headshot w border-Dasha.png';
import Derek from '../images/profile_pics/QUELL-headshot w border-Derek.png';
import Xiao from '../images/profile_pics/QUELL-headshot w border-Xiao.png';

/* 
  Component to generate each teams section
*/

const andrei = {
  name: 'Andrei Cabrera',
  src: Andrei,
  bio:
    'Andrei Cabrera is a full-stack Javascript engineer with a particular interest in user interaction and website performance. specializing in React and Express with a focus in server protocols. He is passionate about open-source projects, refactoring code and testing. Dedicate to his family and friends.',
  linkedin: 'https://www.linkedin.com/in/andrei-cabrera-00324b146/',
  github: 'https://github.com/Andreicabrerao',
};

const dasha = {
  name: 'Dasha Kondratenko',
  src: Dasha,
  bio:
    "Dasha is a full-stack software engineer experienced in JavaScript. She is passionate about code readability, open-source projects and believes in technology's ability to be a force for good. Outside of programming, she is dedicated to her two dogs.",
  linkedin: 'https://www.linkedin.com/in/dasha-k/',
  github: 'https://github.com/dasha-k',
};

const derek = {
  name: 'Derek Sirola',
  src: Derek,
  bio:
    'Derek is a full-stack Javascript engineer with a particular interest for React, Redux, and Express. His passion for community-developed open-source projects makes him an exceptional candidate for Quell. Outside of coding, Derek is an avid piano player and an enthusiastic hiker.',
  linkedin: 'https://www.linkedin.com/in/dsirola1/',
  github: 'https://github.com/dsirola1',
};

const xiao = {
  name: 'Xiao Yu Omeara',
  src: Xiao,
  bio:
    'Xiao is a full-stack software engineer with a passion for maximizing performance and resiliency. Xiao also cares deeply about maintainable code, automated testing, and community-driven open-source projects. Outside of coding, Xiao is a Pilates and indoor rowing enthusiast.',
  linkedin: 'https://www.linkedin.com/in/xyomeara/',
  github: 'https://github.com/xyomeara',
};

const nick = {
  name: 'Nick Kruckenberg',
  src: Nick,
  bio:
    'Nick Kruckenberg is a full-stack software engineer with a particular interest in systems design. He is passionate about ed tech, community-driven open-source projects, readable code, and technology’s potential to solve problems and do good -- a central topic of his teaching and research as a lecturer in philosophy.',
  linkedin: 'https://www.linkedin.com/in/nicholaskruckenberg/',
  github: 'https://github.com/kruckenberg',
};

const mike = {
  name: 'Mike Lauri',
  src: Mike,
  bio:
    'Mike Lauri is a full-stack JavaScript engineer specializing in React and Node.js.  His passion for open source projects, as well as his interest in the inner workings of GraphQL, made Quell a perfect fit.  Prior to Quell, Mike worked as a songwriter and producer in New York City, best known for his work with WWE Music Group.',
  linkedin: 'https://www.linkedin.com/in/mlauri/',
  github: 'https://github.com/MichaelLauri',
};

const rob = {
  name: 'Rob Nobile',
  src: Rob,
  bio:
    'Rob Nobile is a full-stack Javascript engineer specializing in React and Express with a focus in front-end performance optimization and server-side data transfer protocols.  Additional concentrations in tech include auth, testing and SQL.  Prior to Quell, Rob was a Frontend Engineer at EmpowerED Group, Inc. dedicated to the E-learning music space and remains an active contributor.',
  linkedin: 'https://www.linkedin.com/in/robnobile/',
  github: 'https://github.com/RobNobile',
};

const justin = {
  name: 'Justin Jaeger',
  src: Justin,
  bio:
    'Justin Jaeger is a full-stack software engineer, passionate about designing and building performant user interfaces.  Outside of programming, he loves reviewing films and obsessing over Oscar predictions.',
  linkedin: 'https://www.linkedin.com/in/justin-jaeger-81a805b5/',
  github: 'https://github.com/justinjaeger',
};

const Team = () => {
  return (
    <>
      <img id="team-quell" src={Header}></img>
      <div id="team">
        <TeamMember
          src={andrei.src}
          bio={andrei.bio}
          name={andrei.name}
          linkedin={andrei.linkedin}
          github={andrei.github}
        />
        <TeamMember
          src={dasha.src}
          bio={dasha.bio}
          name={dasha.name}
          linkedin={dasha.linkedin}
          github={dasha.github}
        />
        <TeamMember
          src={derek.src}
          bio={derek.bio}
          name={derek.name}
          linkedin={derek.linkedin}
          github={derek.github}
        />
        <TeamMember
          src={xiao.src}
          bio={xiao.bio}
          name={xiao.name}
          linkedin={xiao.linkedin}
          github={xiao.github}
        />
        <TeamMember
          src={nick.src}
          bio={nick.bio}
          name={nick.name}
          linkedin={nick.linkedin}
          github={nick.github}
        />
        <TeamMember
          src={mike.src}
          bio={mike.bio}
          name={mike.name}
          linkedin={mike.linkedin}
          github={mike.github}
        />
        <TeamMember
          src={rob.src}
          bio={rob.bio}
          name={rob.name}
          linkedin={rob.linkedin}
          github={rob.github}
        />
        <TeamMember
          src={justin.src}
          bio={justin.bio}
          name={justin.name}
          linkedin={justin.linkedin}
          github={justin.github}
        />
      </div>
    </>
  );
};

export default Team;
