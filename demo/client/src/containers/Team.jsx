import React from 'react';
import TeamMember from '../components/TeamMember.jsx';
import Header from '../images/headers/QUELL-team quell-2color_1.svg';
import Justin from '../images/profile_pics/QUELL-headshot w border-Justin.svg';
import Mike from '../images/profile_pics/QUELL-headshot w border-Mike.svg';
import Nick from '../images/profile_pics/QUELL-headshot w border-Nick.svg';
import Rob from '../images/profile_pics/QUELL-headshot w border-Rob.svg';

/* 
  Component to generate each teams section
*/

const justin = {
  name: 'Justin Jaeger',
  src: Justin,
  bio:
    'Justin Jaeger is a full-stack software engineer, passionate about designing and building performant user interfaces.  Outside of programming, he loves reviewing films and obsessing over Oscar predictions.',
  linkedin: 'https://www.linkedin.com/in/justin-jaeger-81a805b5/',
  github: 'https://github.com/justinjaeger',
};

const mike = {
  name: 'Mike Lauri',
  src: Mike,
  bio:
    'Mike Lauri is a full-stack JavaScript engineer specializing in React and Node.js.  His passion for open source projects, as well as his interest in the inner workings of GraphQL, made Quell a perfect fit.  Prior to Quell, Mike worked as a songwriter and producer in New York City, best known for his work with WWE Music Group.',
  linkedin: 'https://www.linkedin.com/in/mlauri/',
  github: 'https://github.com/MichaelLauri',
};

const nick = {
  name: 'Nick Kruckenberg',
  src: Nick,
  bio:
    'Nick Kruckenberg is a full-stack software engineer with a particular interest in systems design. He is passionate about ed tech, community-driven open-source projects, readable code, and technology’s potential to solve problems and do good -- a central topic of his teaching and research as a lecturer in philosophy.',
  linkedin: 'https://www.linkedin.com/in/nicholaskruckenberg/',
  github: 'https://github.com/kruckenberg',
};

const rob = {
  name: 'Rob Nobile',
  src: Rob,
  bio:
    'Rob Nobile is a full-stack Javascript engineer specializing in React and Express with a focus in front-end performance optimization and server-side data transfer protocols.  Additional concentrations in tech include auth, testing and SQL.  Prior to Quell, Rob was a Frontend Engineer at EmpowerED Group, Inc. dedicated to the E-learning music space and remains an active contributor.',
  linkedin: 'https://www.linkedin.com/in/robnobile/',
  github: 'https://github.com/RobNobile',
};

const Team = () => {
  return (
    <>
      <img id='team-quell' src={Header}></img>
      <div id='team'>
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
