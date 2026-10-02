import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBasePath} from '../tools/deployment-path.mjs';
import {sitePath,pagePath} from '../web/lib/site-path.js';

test('deployment paths support the site root and nested project paths',()=>{
 for(const value of ['','/'])assert.equal(normalizeBasePath(value),'');
 for(const value of ['/granaderos','/granaderos/'])assert.equal(normalizeBasePath(value),'/granaderos');
 assert.equal(normalizeBasePath('/games/granaderos/'),'/games/granaderos');
 for(const value of ['granaderos','//example.com/game','https://example.com/game','/game?test=1','/game#intro','/game/../other','/game/./other','/game//other','/game name'])assert.throws(()=>normalizeBasePath(value),/GRANADEROS_BASE_PATH/);
});

test('project hosting resolves saved and catalog art without changing their URLs',()=>{
 const item={art:'/art/weapon-1800.png'},before=JSON.stringify(item);
 assert.equal(sitePath(item.art,'/granaderos'),'/granaderos/art/weapon-1800.png');
 assert.equal(JSON.stringify(item),before);
 assert.equal(sitePath('/art/pixel/granadero-idle-atlas.png','/granaderos'),'/granaderos/art/pixel/granadero-idle-atlas.png');
 assert.equal(sitePath('/campaigns/example.json?download=1','/granaderos'),'/granaderos/campaigns/example.json?download=1');
 assert.equal(sitePath('/granaderos/art/portrait-57.webp','/granaderos'),'/granaderos/art/portrait-57.webp');
 assert.equal(sitePath('/art/portrait-57.webp',''),'/art/portrait-57.webp');
});

test('browser-created, external and optional image URLs pass through unchanged',()=>{
 for(const value of ['https://example.com/portrait.png','//example.com/portrait.png','data:image/png;base64,AAA','blob:https://example.com/id','#pattern','relative.png','',null,undefined])assert.equal(sitePath(value,'/granaderos'),value);
});

test('page navigation retains queries and fragments in static directory URLs',()=>{
 assert.equal(pagePath('/','/granaderos'),'/granaderos/');
 assert.equal(pagePath('/story','/granaderos'),'/granaderos/story/');
 assert.equal(pagePath('/editor/#terrain','/granaderos'),'/granaderos/editor/#terrain');
 assert.equal(pagePath('/?content=1','/granaderos'),'/granaderos/?content=1');
 assert.equal(pagePath('/granaderos/story?test=1#characters','/granaderos'),'/granaderos/story/?test=1#characters');
 assert.equal(pagePath('/story',''),'/story');
 assert.equal(pagePath('/?content=1',''),'/?content=1');
 assert.equal(pagePath('https://example.com/','/granaderos'),'https://example.com/');
});
