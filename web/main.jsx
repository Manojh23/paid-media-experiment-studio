import React from 'react';
import {createRoot} from 'react-dom/client';
import './base.css';
import MediaStudio from '../Studio.jsx';

async function api(path,options={}){
  const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??'The request could not be completed.');
  return data;
}
createRoot(document.getElementById('root')).render(<main><MediaStudio api={api}/></main>);
