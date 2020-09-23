import React from 'react';
import Linkedin from '../images/icons/QUELL-icons-linkedin.svg';
import Github from '../images/icons/QUELL-icons-github.svg';

/* 
  Reusable component to generate each team member
*/

const TeamMember = (props) => {
  const { src, bio, name, linkedin, github } = props;

  return (
    <div className='profile-pics'>
      <img src={src} alt='Quell Team'></img>
      <p className='team-member-name'>{name}</p>
      <p>{bio}</p>
      <div className='social-icons'>
        <a href={linkedin} target='_blank'>
          <img src={Linkedin}></img>
        </a>
        <a href={github} target='_blank'>
          <img src={Github}></img>
        </a>
      </div>
    </div>
  );
};

export default TeamMember;
