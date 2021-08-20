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
import Robleh from '../images/profile_pics/QUELL-headshot w border-Robleh.png';
import Thomas from '../images/profile_pics/QUELL-headshot w border-Thomas.png';
import Angela from '../images/profile_pics/QUELL-headshot w border-Angela.png';
import Ken from '../images/profile_pics/QUELL-headshot w border-Ken.png';
import Jinhee from '../images/profile_pics/QUELL-headshot w border-Jinhee.png'; 
import Nayan from '../images/profile_pics/QUELL-headshot w border-Nayan.png'; 
import Tash from '../images/profile_pics/QUELL-headshot w border-Tash.png'; 
import Tim from '../images/profile_pics/QUELL-headshot w border-Tim.png'; 


/* 
  Component to generate each teams section
*/

const jinhee = {
  name: 'Jinhee Choi',
  src: Jinhee,
  bio:
    'Jinhee is a full-stack software engineer specializing in React, Node.js, Express, relational databases, non-relational databases, graphQL, with a passion for cache invalidation and implementing performant client-side caching storage. Jinhee enjoys visiting local attraction places with his wife and follows New York Yankees.',
  linkedin: 'https://www.linkedin.com/in/jinheekchoi/',
  github: 'https://github.com/jcroadmovie',
};

const nayan = {
  name: 'Nayan Parmar',
  src: Nayan,
  bio:
    'Nayan is a full-stack software engineer specializing in React, Express, relational database, with a passion for contributing to open-source code. He has strong interest in performance optimization and front-end tech. In his free time, Nayan enjoys watching a variety of movies, and always try to find interesting books to read.',
  linkedin: 'https://www.linkedin.com/in/nparmar1/',
  github: 'https://github.com/nparmar1',
};

const tash = {
  name: 'Tashrif Sanil',
  src: Tash,
  bio:
    'Tash is a full-stack software engineer specializing in Node.js, C++, Redis, GraphQL, with a passion for performance optimization. His goal with Quell is to improve server side cache retrieval response time and cache invalidation. In his free time, he likes to practice latte art.',
  linkedin: 'https://www.linkedin.com/in/tashrif-sanil-5a499415b/',
  github: 'https://github.com/tashrifsanil',
};

const tim = {
  name: 'Tim Frenzel',
  src: Tim,
  bio:
    'Tim is a passionate database and system engineer with a strong desire to learn and work on scalable and non-linear systems that ultimately allow him to take deeper dives into data analytics. Hence, he focused primarily on performance questions like caching strategies, batching, and in-memory databases. Outside of engineering time, Tim is working on his meme mastery, travels across the globe, and develops investment algos.',
  linkedin: 'https://www.linkedin.com/in/tim-frenzel-mba-cfa-frm-61a35499/',
  github: 'https://github.com/TimFrenzel',
};

// old team
const robleh = {
  name: 'Robleh Farah',
  src: Robleh,
  bio:
    'Robleh is a full-stack software engineer specializing in React, Express, and relational databases, with a passion for code dependability, optimization, and test driven development. His devotion to open-source projects, and strong interest in GraphQL, makes him an ideal candidate for Quell. Outside of coding, Robleh enjoys hiking, tea collecting, and volunteering in developing countries abroad.',
  linkedin: 'https://www.linkedin.com/in/farahrobleh/',
  github: 'https://github.com/farahrobleh',
};

const thomas = {
  name: 'Thomas Reeder',
  src: Thomas,
  bio:
    'Thomas is a full-stack JavaScript engineer specializing in React and Node.js, and always wishes he had more time to write tests. His goal with Quell is maintaining a consistent, modular codebase to make future development simple and enjoyable. In his free time he can be found trying to bake pastries, or singing ABBA songs at karaoke.',
  linkedin: 'https://www.linkedin.com/in/thomas-reeder/',
  github: 'https://github.com/nomtomnom',
};

const angela = {
  name: 'Angela Franco',
  src: Angela,
  bio:
    'Angela is a full-stack software engineer experienced in React and Express, with a passion for code reliability and testing. She has a particular interest in exploring innovative technologies to build tools that make the world a better place. Outside of coding, Angela is a travel and hospitality enthusiast and a Soccer World Cup fanatic.',
  linkedin: 'https://www.linkedin.com/in/angela-j-franco/',
  github: 'https://github.com/ajfranco18',
};

const ken = {
  name: 'Ken Litton',
  src: Ken,
  bio:
    'Ken is a full-stack JavaScript software engineer with a passion for test driven development and recursive algorithms. He cares deeply about sharing what he learns through open-source projects and making the world a more open-minded place to live. Outside of coding, Ken is an avid reader of classical fiction, psychological studies, and hip-hop lyrics.',
  linkedin: 'https://www.linkedin.com/in/ken-litton/',
  github: 'https://github.com/kenlitton',
};

const andrei = {
  name: 'Andrei Cabrera',
  src: Andrei,
  bio:
    'Andrei Cabrera is a full-stack JavaScript engineer with a particular interest in user interaction and website performance. specializing in React and Express with a focus in server protocols. He is passionate about open-source projects, refactoring code and testing. Dedicate to his family and friends.',
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
    'Derek is a full-stack JavaScript engineer with a particular interest for React, Redux, and Express. His passion for community-developed open-source projects makes him an exceptional candidate for Quell. Outside of coding, Derek is an avid piano player and an enthusiastic hiker.',
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
    'Rob Nobile is a full-stack JavaScript engineer specializing in React and Express with a focus in front-end performance optimization and server-side data transfer protocols.  Additional concentrations in tech include auth, testing and SQL.  Prior to Quell, Rob was a Frontend Engineer at EmpowerED Group, Inc. dedicated to the E-learning music space and remains an active contributor.',
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
          src={jinhee.src}
          bio={jinhee.bio}
          name={jinhee.name}
          linkedin={jinhee.linkedin}
          github={jinhee.github}
        />
                <TeamMember
          src={nayan.src}
          bio={nayan.bio}
          name={nayan.name}
          linkedin={nayan.linkedin}
          github={nayan.github}
        />
                <TeamMember
          src={tash.src}
          bio={tash.bio}
          name={tash.name}
          linkedin={tash.linkedin}
          github={tash.github}
        />
                <TeamMember
          src={tim.src}
          bio={tim.bio}
          name={tim.name}
          linkedin={tim.linkedin}
          github={tim.github}
        />
        <TeamMember
          src={robleh.src}
          bio={robleh.bio}
          name={robleh.name}
          linkedin={robleh.linkedin}
          github={robleh.github}
        />
        <TeamMember
          src={thomas.src}
          bio={thomas.bio}
          name={thomas.name}
          linkedin={thomas.linkedin}
          github={thomas.github}
        /> 
         <TeamMember
          src={angela.src}
          bio={angela.bio}
          name={angela.name}
          linkedin={angela.linkedin}
          github={angela.github}
        />
        <TeamMember
          src={ken.src}
          bio={ken.bio}
          name={ken.name}
          linkedin={ken.linkedin}
          github={ken.github}
        />
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
