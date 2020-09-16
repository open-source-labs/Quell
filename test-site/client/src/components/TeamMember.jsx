import React from 'react';

const TeamMember = (props) => {
  const { src, bio, name } = props;

  return (
    <div className='profile-pics'>
      <img src={src} alt='Quell Team'></img>
      <p className='team-member-name'>{name}</p>
      <p>{bio}</p>
    </div>
  );
};

export default TeamMember;
