const cloud = require('wx-server-sdk')
const foods = require('./foods.json')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async function() {
  const now = Date.now()
  var existing = await db.collection('foods').limit(1000).get().then(function(r){return r.data}).catch(function(){return[]})
  var em = new Map(existing.map(function(f){return[f._id,f]}))
  var toCreate=[], toUpdate=[]
  for(var i=0;i<foods.length;i++){
    var item=foods[i], _id=item._id
    var data=Object.assign({},item,{updatedAt:now})
    if(em.has(_id)){toUpdate.push({_id:_id,data:data})}
    else{data.createdAt=now;toCreate.push({_id:_id,data:Object.assign({_id:_id},data)})}
  }
  var coll=db.collection('foods'),B=100,updated=0,created=0
  for(var j=0;j<toUpdate.length;j+=B){var b=toUpdate.slice(j,j+B);await Promise.all(b.map(function(x){return coll.doc(x._id).update({data:x.data}).catch(function(){})}));updated+=b.length}
  for(var k=0;k<toCreate.length;k+=B){var b=toCreate.slice(k,k+B);await Promise.all(b.map(function(x){return coll.add({data:x.data}).catch(function(){})}));created+=b.length}
  try{await db.collection('dish_cache').doc('__init__').get()}catch(e){if(e.message&&e.message.indexOf('Collection')>=0){try{await db.createCollection('dish_cache')}catch(_){}}}
  return{foods:{total:foods.length,created,updated},message:'食材库同步完成。'}
}
