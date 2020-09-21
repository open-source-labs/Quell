import React from 'react';
import TeamMember from '../components/TeamMember.jsx';
import Header from '../images/headers/QUELL-team quell-2color_1.svg';
import Justin from '../images/profile_pics/QUELL-headshot w border-Justin.svg';
import Mike from '../images/profile_pics/QUELL-headshot w border-Mike.svg';
import Nick from '../images/profile_pics/QUELL-headshot w border-Nick.svg';
import Rob from '../images/profile_pics/QUELL-headshot w border-Rob.svg';

const justin = {
  name: 'Justin Jaeger',
  src: Justin,
  bio:
    'Id ad cillum enim sint sit enim deserunt dolor. Irure anim laborum consequat eu adipisicing culpa cupidatat reprehenderit aliquip officia sunt voluptate. Ipsum est nostrud incididunt irure velit. Voluptate irure ullamco excepteur cupidatat.',
  linkedin: 'https://www.linkedin.com/in/justin-jaeger-81a805b5/',
  github: 'https://github.com/justinjaeger',
};

const mike = {
  name: 'Mike Lauri',
  src: Mike,
  bio:
    'Do excepteur sint sit non id laboris velit nostrud sit do. Incididunt tempor velit ex magna est labore officia excepteur velit irure consectetur. Excepteur dolor occaecat amet laborum commodo Lorem veniam.',
  linkedin: 'https://www.linkedin.com/in/mlauri/',
  github: 'https://github.com/MichaelLauri',
};

const nick = {
  name: 'Nick Kruckenberg',
  src: Nick,
  bio:
    'Ullamco et aliqua ut pariatur duis nostrud. Occaecat aute minim duis mollit. Labore laborum sit quis officia nostrud deserunt qui duis aute in minim fugiat.',
  linkedin: 'https://www.linkedin.com/in/nicholaskruckenberg/',
  github: 'https://github.com/kruckenberg',
};

const rob = {
  name: 'Rob Nobile',
  src: Rob,
  bio:
    'Non esse occaecat ipsum incididunt sunt dolore magna tempor ut. Voluptate commodo duis laboris Lorem aliquip esse consequat fugiat magna ad ad voluptate irure et. Tempor cupidatat tempor ipsum consectetur eiusmod adipisicing id in ex anim pariatur. Enim minim est amet aliquip cillum do sunt elit non.',
  linkedin: 'https://www.linkedin.com/in/robertnobile/',
  github: 'https://github.com/RobNobile',
};

const Team = () => {
  return (
    <div id='team'>
      <img id='team-quell' src={Header}></img>
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
  );
};

export default Team;
