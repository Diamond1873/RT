// --- ตั้งค่า SUPABASE (เปลี่ยนค่าตรงนี้) ---
const SUPABASE_URL = 'https://bxoirmzekfglhhwjahod.supabase.co/rest/v1/';
const SUPABASE_KEY = 'sb_publishable_Iq_UD7L3d4J6PVBFZE81gg_zU-BwKox';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// พิกัดร้าน (ศรีสะเกษ) ตามที่คุณให้มา
const SHOP_LAT = 14.480981;
const SHOP_LNG = 104.717119;

let cart = [];
let deliveryFee = 0;
let userCoords = null;

// 1. ดึงเมนูจาก Database มาแสดง (หน้าลูกค้า)
async function loadMenu() {
    const { data, error } = await _supabase.from('menus').select('*').eq('is_available', true);
    if (error) return;

    const container = document.getElementById('menu-container');
    if (!container) return;

    container.innerHTML = data.map(m => `
        <div class="bg-white rounded-2xl shadow-sm flex overflow-hidden border border-gray-100">
            <img src="${m.image_url || 'https://via.placeholder.com/150'}" class="w-28 h-28 object-cover">
            <div class="p-3 flex-1 flex flex-col justify-between">
                <h3 class="font-bold text-gray-800">${m.name}</h3>
                <div class="flex justify-between items-center">
                    <span class="text-orange-600 font-bold">${m.price}.-</span>
                    <button onclick="addToCart('${m.id}', '${m.name}', ${m.price})" class="bg-orange-500 text-white px-4 py-1 rounded-lg text-sm font-bold">+ เพิ่ม</button>
                </div>
            </div>
        </div>
    `).join('');
}

// 2. ระบบคำนวณระยะทางและค่าส่ง
function getLocation() {
    const btn = document.getElementById('btn-loc');
    btn.innerText = "กำลังหาพิกัด...";
    
    navigator.geolocation.getCurrentPosition(pos => {
        userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const dist = calcDist(SHOP_LAT, SHOP_LNG, userCoords.lat, userCoords.lng);
        
        // เงื่อนไขค่าส่งที่คุณกำหนด
        if (dist <= 3) deliveryFee = 0;
        else if (dist <= 5) deliveryFee = 10;
        else if (dist <= 10) deliveryFee = 20;
        else { alert("ไกลเกิน 10 กม. ส่งไม่ได้จ้า"); return; }

        document.getElementById('delivery-info').innerText = `ระยะทาง ${dist.toFixed(2)} กม. | ค่าส่ง ${deliveryFee} บาท`;
        document.getElementById('delivery-info').classList.remove('hidden');
        btn.innerText = "✅ ดึงพิกัดสำเร็จ";
        updateTotal();
    });
}

function calcDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// 3. ระบบจัดการตะกร้าสินค้า
function addToCart(id, name, price) {
    cart.push({ id, name, price });
    document.getElementById('cart-count').innerText = cart.length;
    updateTotal();
}

function updateTotal() {
    const foodTotal = cart.reduce((sum, item) => sum + item.price, 0);
    const total = foodTotal + deliveryFee;
    document.getElementById('total-price-display').innerText = total;
    document.getElementById('pay-amount').innerText = total;
}

// 4. ระบบ Admin (Real-time ออเดอร์เข้า)
function initAdmin() {
    _supabase.channel('orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
        audio.play();
        alert('กริ๊งๆ! มีออเดอร์ใหม่เข้ามาค่ะคุณแม่');
        loadAdminOrders();
    }).subscribe();
    loadAdminOrders();
}

async function loadAdminOrders() {
    const { data } = await _supabase.from('orders').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('admin-orders');
    if (!list) return;

    list.innerHTML = data.map(o => `
        <div class="bg-white p-5 rounded-2xl shadow-sm border-l-8 ${o.payment_status === 'pending' ? 'border-red-500' : 'border-green-500'}">
            <div class="flex justify-between mb-2">
                <span class="font-bold">ออเดอร์ #${o.id.slice(0,5)}</span>
                <span class="text-sm text-gray-400">${new Date(o.created_at).toLocaleTimeString()}</span>
            </div>
            <p class="text-sm text-gray-600 mb-2">รายการ: ${o.items.map(i => i.name).join(', ')}</p>
            <p class="font-bold text-orange-600">รวม: ${o.total_price}.-</p>
            <div class="mt-3 flex gap-2">
                <a href="${_supabase.storage.from('slips').getPublicUrl(o.slip_url).data.publicUrl}" target="_blank" class="text-xs bg-gray-100 px-3 py-1 rounded">ดูสลิป</a>
                <button onclick="updateStatus('${o.id}')" class="text-xs bg-green-500 text-white px-3 py-1 rounded">ยืนยันรับเงิน</button>
            </div>
        </div>
    `).join('');
}

// เริ่มต้นโหลดเมนูหน้าแรก
loadMenu();
