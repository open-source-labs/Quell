import React from 'react';
import TeamMember from '../components/TeamMember.jsx';

const justin = {
  name: 'Justin Jaeger',
  src: '../images/profile_pics/QUELL-headshot w border-Justin.svg',
  bio:
    'Id ad cillum enim sint sit enim deserunt dolor. Irure anim laborum consequat eu adipisicing culpa cupidatat reprehenderit aliquip officia sunt voluptate. Ipsum est nostrud incididunt irure velit. Voluptate irure ullamco excepteur cupidatat.',
};

const mike = {
  name: 'Mike Lauri',
  src: '../images/profile_pics/QUELL-headshot w border-Mike.svg',
  bio:
    'Do excepteur sint sit non id laboris velit nostrud sit do. Incididunt tempor velit ex magna est labore officia excepteur velit irure consectetur. Excepteur dolor occaecat amet laborum commodo Lorem veniam.',
};

const nick = {
  name: 'Nick Kruckenberg',
  src: '../images/profile_pics/QUELL-headshot w border-Nick.svg',
  bio:
    'Ullamco et aliqua ut pariatur duis nostrud. Occaecat aute minim duis mollit. Labore laborum sit quis officia nostrud deserunt qui duis aute in minim fugiat.',
};

const rob = {
  name: 'Rob Nobile',
  src: '../images/profile_pics/QUELL-headshot w border-Rob.svg',
  bio:
    'Non esse occaecat ipsum incididunt sunt dolore magna tempor ut. Voluptate commodo duis laboris Lorem aliquip esse consequat fugiat magna ad ad voluptate irure et. Tempor cupidatat tempor ipsum consectetur eiusmod adipisicing id in ex anim pariatur. Enim minim est amet aliquip cillum do sunt elit non.',
};

const Team = () => {
  return (
    <div id='team'>
      <img
        id='team-quell'
        src='../images/quell_logos/QUELL-team quell.svg'
      ></img>
      <TeamMember src={nick.src} bio={nick.bio} name={nick.name} />
      <TeamMember src={rob.src} bio={rob.bio} name={rob.name} />
      <TeamMember src={mike.src} bio={mike.bio} name={mike.name} />
      <TeamMember src={justin.src} bio={justin.bio} name={justin.name} />
    </div>
  );
};

export default Team;
