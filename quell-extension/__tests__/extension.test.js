/* eslint-disable no-undef */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { jest } from '@jest/globals';
import { enableFetchMocks, fetchMock } from 'jest-fetch-mock';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import App from '../src/pages/Panel/App';
import CacheTab from '../src/pages/Panel/Components/CacheTab';
import InputEditor from '../src/pages/Panel/Components/InputEditor';
import Metrics from '../src/pages/Panel/Components/Metrics';
import NavButton from '../src/pages/Panel/Components/NavButton';
import OutputEditor from '../src/pages/Panel/Components/OutputEditor';
import PrimaryNavBar from '../src/pages/Panel/Components/PrimaryNavBar';
import QueryTab from '../src/pages/Panel/Components/QueryTab';
import Settings from '../src/pages/Panel/Components/Settings';
import { act } from 'react-dom/test-utils';



enableFetchMocks();

//workaround for TypeError: range(...).getBoundingClientRect is not a function
document.createRange = () => {
  const range = new Range();

  range.getBoundingClientRect = jest.fn();

  range.getClientRects = () => {
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: jest.fn()
    };
  };

  return range;
}

xdescribe('App', () => {
  it('renders App component correctly', () => {
    fetch.mockResponseOnce(JSON.stringify({ "data": {
      "__schema": { "types": [{"name": "String"}]}}}))
    render(<App />);

    const tabs = screen.queryAllByRole('button', /tab/i);
    expect(tabs).toHaveLength(10);
  })

  it('renders correct component when tab is clicked', () => {
    const app = render(<App />);
    const querybtn = app.container.querySelector('#queryButton')
    const networkbtn = app.container.querySelector('#networkButton');
    const cachebtn = app.container.querySelector('#cacheButton')
    const settingsbtn = app.container.querySelector('#settingsButton')

    
    fireEvent.click(networkbtn);
    expect(activeTab).toEqual('network');
    fireEvent.click(cachebtn);
    expect(activeTab).toEqual('cache');
    fireEvent.click(settingsbtn);
    expect(activeTab).toEqual('settings');
    fireEvent.click(querybtn);
    expect(activeTab).toEqual('query');
  })
})
//test the nav button 



describe('CacheTab', () => {
  it('renders CacheTab component correctly', () => {
    act(() => {
    fetch.mockResponseOnce(JSON.stringify({ "server": [
      {
        "name": "Redis version"
      }
    ]}))
    render(<CacheTab />)
  })
  })
})
