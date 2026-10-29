import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceNeeds, initialNeeds, initialWorld, creatures, places } from './world.ts';
const positions = () => Object.fromEntries(creatures.map(c => [c.id,{x:c.x,y:c.y}]));
test('needs only recover after reaching food or rest; values stay bounded',()=>{
 const world=initialWorld(), p=positions(), n=initialNeeds();
 world.decisions.bean={action:'eat',target:'orchard',flying:false};
 assert.ok(advanceNeeds(n,world,p).bean.hunger>n.bean.hunger);
 p.bean={x:places.orchard[0],y:places.orchard[1]};
 assert.equal(advanceNeeds(n,world,p).bean.hunger,n.bean.hunger-5);
 world.decisions.mochi={action:'sleep',target:'cottage',flying:false};
 p.mochi={x:places.cottage[0],y:places.cottage[1]};n.mochi.energy=99;n.bean.hunger=1;
 const next=advanceNeeds(n,world,p);
 assert.equal(next.mochi.energy,100);assert.equal(next.bean.hunger,0);
 assert.equal(n.bean.hunger,1);
});
