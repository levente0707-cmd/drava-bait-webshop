const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'zsombi';

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ASSETS_DIR = path.join(__dirname, 'public', 'assets');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, '[]');

app.use(express.json({limit:'8mb'}));
app.use(express.static(path.join(__dirname, 'public')));

function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function writeJson(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function readOrders(){ return readJson(ORDERS_FILE); }
function writeOrders(x){ writeJson(ORDERS_FILE,x); }
function readProducts(){ return readJson(PRODUCTS_FILE); }
function writeProducts(x){ writeJson(PRODUCTS_FILE,x); }
function adminOk(req){ return req.get('x-admin-password') === ADMIN_PASSWORD; }

app.get('/api/products', (req,res)=>res.json(readProducts()));

app.post('/api/orders', (req,res)=>{
  const {customer, items, shipping, payment} = req.body || {};
  if(!customer || !customer.name || !customer.email || !customer.phone || !customer.address)
    return res.status(400).json({error:'Hiányos vásárlói adatok.'});
  if(!Array.isArray(items) || items.length === 0)
    return res.status(400).json({error:'A kosár üres.'});

  const products = readProducts();
  let total = 0;
  const cleanItems = [];
  for(const row of items){
    const p = products.find(x=>x.id === Number(row.id));
    const qty = Math.max(1, Math.min(99, Number(row.qty)||0));
    if(!p || !qty) return res.status(400).json({error:'Érvénytelen termék.'});
    total += Number(p.price) * qty;
    cleanItems.push({id:p.id,name:p.name,price:Number(p.price),qty});
  }

  const orders = readOrders();
  const order = {
    id: 'DB-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    createdAt: new Date().toISOString(),
    status: 'Új',
    customer: {
      name:String(customer.name).trim(), email:String(customer.email).trim(),
      phone:String(customer.phone).trim(), address:String(customer.address).trim()
    },
    shipping:String(shipping||''), payment:String(payment||''),
    items:cleanItems, total
  };
  orders.unshift(order);
  writeOrders(orders);
  console.log(`Új rendelés: ${order.id} — ${order.total} Ft — ${order.customer.name}`);
  res.status(201).json({ok:true, orderId:order.id, total:order.total});
});

app.get('/api/admin/orders',(req,res)=>{
  if(!adminOk(req)) return res.status(401).json({error:'Hibás admin jelszó.'});
  res.json(readOrders());
});

app.patch('/api/admin/orders/:id',(req,res)=>{
  if(!adminOk(req)) return res.status(401).json({error:'Hibás admin jelszó.'});
  const allowed=['Új','Feldolgozás alatt','Feladva','Teljesítve','Törölve'];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:'Érvénytelen státusz.'});
  const orders=readOrders(); const order=orders.find(x=>x.id===req.params.id);
  if(!order) return res.status(404).json({error:'Rendelés nem található.'});
  order.status=req.body.status; writeOrders(orders); res.json(order);
});

// ===== TERMÉK ADMIN API =====
app.get('/api/admin/products',(req,res)=>{
  if(!adminOk(req)) return res.status(401).json({error:'Hibás admin jelszó.'});
  res.json(readProducts());
});

app.post('/api/admin/products',(req,res)=>{
  if(!adminOk(req)) return res.status(401).json({error:'Hibás admin jelszó.'});
  const {name, price, desc, cat, tag, imageData, imageName} = req.body || {};
  const cleanName = String(name||'').trim();
  const cleanDesc = String(desc||'').trim();
  const cleanCat = String(cat||'feeder').trim();
  const cleanTag = String(tag||cleanCat).trim().toUpperCase();
  const cleanPrice = Number(price);

  if(!cleanName) return res.status(400).json({error:'A termék neve kötelező.'});
  if(!Number.isFinite(cleanPrice) || cleanPrice < 0) return res.status(400).json({error:'Az ár érvénytelen.'});
  if(cleanName.length > 100 || cleanDesc.length > 1000) return res.status(400).json({error:'Túl hosszú termékadat.'});

  let image = '';
  if(imageData){
    const match = String(imageData).match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
    if(!match) return res.status(400).json({error:'Csak PNG, JPG vagy WEBP kép tölthető fel.'});
    const ext = match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg';
    const filename = 'product-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(ASSETS_DIR, filename), Buffer.from(match[2],'base64'));
    image = 'assets/' + filename;
  }

  const products = readProducts();
  const nextId = products.length ? Math.max(...products.map(p=>Number(p.id)||0))+1 : 1;
  const product = {id:nextId,name:cleanName,cat:cleanCat,price:Math.round(cleanPrice),desc:cleanDesc,tag:cleanTag,image};
  products.push(product);
  writeProducts(products);
  res.status(201).json(product);
});

app.put('/api/admin/products/:id',(req,res)=>{
  if(!adminOk(req)) return res.status(401).json({error:'Hibás admin jelszó.'});
  const products = readProducts();
  const product = products.find(p=>p.id===Number(req.params.id));
  if(!product) return res.status(404).json({error:'Termék nem található.'});

  const {name, price, desc, cat, tag, imageData} = req.body || {};
  if(name !== undefined) product.name=String(name).trim();
  if(desc !== undefined) product.desc=String(desc).trim();
  if(cat !== undefined) product.cat=String(cat).trim();
  if(tag !== undefined) product.tag=String(tag).trim().toUpperCase();
  if(price !== undefined){
    const n=Number(price);
    if(!Number.isFinite(n)||n<0) return res.status(400).json({error:'Az ár érvénytelen.'});
    product.price=Math.round(n);
  }

  if(imageData){
    const match=String(imageData).match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
    if(!match) return res.status(400).json({error:'Csak PNG, JPG vagy WEBP kép tölthető fel.'});
    const ext=match[1].includes('png')?'png':match[1].includes('webp')?'webp':'jpg';
    const filename='product-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.'+ext;
    fs.writeFileSync(path.join(ASSETS_DIR,filename),Buffer.from(match[2],'base64'));
    product.image='assets/'+filename;
  }
  writeProducts(products);
  res.json(product);
});

app.delete('/api/admin/products/:id',(req,res)=>{
  if(!adminOk(req)) return res.status(401).json({error:'Hibás admin jelszó.'});
  const products=readProducts();
  const index=products.findIndex(p=>p.id===Number(req.params.id));
  if(index<0) return res.status(404).json({error:'Termék nem található.'});
  const removed=products.splice(index,1)[0];
  writeProducts(products);
  res.json({ok:true,removed});
});

app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.listen(PORT,()=>console.log(`Dráva Bait fut: http://localhost:${PORT}`));
