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
    'Constructed Redis and PostgreSQL databases, contributed development of Express server, and designed demo application interface in React',
  linkedin: 'https://www.linkedin.com/in/justin-jaeger-81a805b5/',
  github: 'https://github.com/justinjaeger',
};

const mike = {
  name: 'Mike Lauri',
  src: Mike,
  bio:
    'Architected website with React, contributed to client-side caching functionality, and implemented Travis CI for continuous integration',
  linkedin: 'https://www.linkedin.com/in/mlauri/',
  github: 'https://github.com/MichaelLauri',
};

const nick = {
  name: 'Nick Kruckenberg',
  src: Nick,
  bio:
    'Built client- and server-side caching functionality, developed partial query caching algorithms, created image containers with Docker for AWS deployment',
  linkedin: 'https://www.linkedin.com/in/nicholaskruckenberg/',
  github: 'https://github.com/kruckenberg',
};

const rob = {
  name: 'Rob Nobile',
  src: Rob,
  bio:
    'Created testing suite with Jest, architected demo application with React, built and debugged client-side caching functionality, and implemented Travis CI for continuous integration',
  linkedin: 'https://www.linkedin.com/in/robertnobile/',
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
