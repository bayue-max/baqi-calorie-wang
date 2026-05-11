const cloud = require('wx-server-sdk')
const dishes = require('./composite_dishes.json')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async function() {
  const now = Date.now()
  var existing = await db.collection('composite_dishes').limit(1000).get().then(function(r){return r.data}).catch(function(){return[]})
  var em = new Map(existing.map(function(f){return[f._id,f]}))
  var toCreate=[], toUpdate=[]
  for(var i=0;i<dishes.length;i++){
    var item=dishes[i], _id=item._id
    var data=Object.assign({},item,{updatedAt:now})
    if(em.has(_id)){toUpdate.push({_id:_id,data:data})}
    else{data.createdAt=now;toCreate.push({_id:_id,data:Object.assign({_id:_id},data)})}
  }
  var coll=db.collection('composite_dishes'),B=200,updated=0,created=0
  for(var j=0;j<toUpdate.length;j+=B){var b=toUpdate.slice(j,j+B);await Promise.all(b.map(function(x){return coll.doc(x._id).update({data:x.data}).catch(function(){})}));updated+=b.length}
  for(var k=0;k<toCreate.length;k+=B){var b=toCreate.slice(k,k+B);await Promise.all(b.map(function(x){return coll.add({data:x.data}).catch(function(){})}));created+=b.length}
  return{compositeDishes:{total:dishes.length,created,updated},message:'复合菜品库同步完成。'}
}
