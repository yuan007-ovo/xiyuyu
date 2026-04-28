// ==========================================
// Chat 模块专属逻辑 (chat.js)
// ==========================================

// 获取所有实体 (包含角色、用户账号和NPC)
function getAllEntities() {
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    let npcs = JSON.parse(ChatDB.getItem('chat_npcs') || '[]'); // 核心修改：引入独立的 NPC 库
    let mappedAccounts = accounts.map(a => ({
        ...a, // 核心修复：保留账号的所有原始属性（包含 password, payPassword, personaId 等）
        id: a.id,
        name: a.netName || '未命名',
        netName: a.netName || '未命名',
        account: a.account,
        avatarUrl: a.avatarUrl,
        signature: a.signature,
        contactGroup: '默认分组',
        isAccount: true
    }));
    return chars.concat(mappedAccounts).concat(npcs);
}

// --- 面板开关逻辑 ---
const chatPanel = document.getElementById('chatPanel');
const personaPanel = document.getElementById('personaPanel');
const wechatPanel = document.getElementById('wechatPanel');

// 点击桌面 Chat 图标时触发
function openChatPanel() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let isValidLogin = false;

    if (currentLoginId) {
        let allEntities = getAllEntities();
        // 严格校验：不仅要有登录状态，该账号/角色还必须真实存在于数据库中
        if (allEntities.some(a => a.id === currentLoginId)) {
            isValidLogin = true;
        } else {
            // 账号已被删除，清理无效的幽灵登录状态
            ChatDB.removeItem('current_login_account');
        }
    }

    if (isValidLogin) {
        // 如果已经登录且账号有效，直接打开微信界面
        wechatPanel.style.display = 'flex';
        renderMePage();
        renderChatList(); 
        renderContactList(); 
        renderMoments(); // 【核心修复】：打开应用时立即渲染朋友圈
    } else {
        // 如果未登录或账号失效，打开注册/登录界面
        chatPanel.style.display = 'flex';
    }
}

function closeChatPanel() {
    chatPanel.style.display = 'none';
    document.getElementById('chatPresetPopup').classList.remove('show');
}

// 微信界面的 Back 按钮：直接隐藏面板回到桌面，不退出登录！
function closeWechatPanel() {
    wechatPanel.style.display = 'none';
}

// ==========================================
// 人设面具 编辑与保存逻辑
// ==========================================
let currentEditingPersonaId = null; // 全局变量：记录当前正在编辑的面具ID

// 1. 新建面具 (从注册弹窗进入)
function openPersonaPanel() {
    document.getElementById('chatPresetPopup').classList.remove('show');
    currentEditingPersonaId = null; // 标记为新建模式
    
    // 清空表单
    document.getElementById('pIdInput').value = '';
    document.getElementById('pSexInput').value = '';
    document.getElementById('pPersonaInput').value = '';
    document.getElementById('pAvatarUpload').style.backgroundImage = '';
    document.getElementById('pAvatarUpload').innerText = '上传头像';

    personaPanel.style.display = 'flex';
}

function closePersonaPanel() {
    personaPanel.style.display = 'none';
}

// 2. 编辑当前面具 (从微信主页 Edit 进入)
function editCurrentPersona() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;
    
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === currentLoginId);
    if (!account) return;

    // 核心修改：如果是 Char 登录，直接打开角色编辑面板
    if (!account.isAccount) {
        openCharEditPanel(currentLoginId);
        return;
    }

    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === account.personaId);
    if (!persona) return alert('未找到绑定的面具信息！');

    // 标记为编辑模式，记录当前面具ID
    currentEditingPersonaId = persona.id;

    // 将面具数据回显到表单中
    document.getElementById('pIdInput').value = persona.realName || '';
    document.getElementById('pSexInput').value = persona.sex || '';
    document.getElementById('pPersonaInput').value = persona.persona || '';
    
    const avatarUpload = document.getElementById('pAvatarUpload');
    if (persona.avatarUrl) {
        avatarUpload.style.backgroundImage = `url(${persona.avatarUrl})`;
        avatarUpload.innerText = '';
    } else {
        avatarUpload.style.backgroundImage = '';
        avatarUpload.innerText = '上传头像';
    }

    personaPanel.style.display = 'flex';
}
// 根据指定 ID 编辑面具 (从面具管理面板进入)
function editPersonaById(personaId) {
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return alert('未找到该面具信息！');

    // 标记为编辑模式，记录当前面具ID
    currentEditingPersonaId = persona.id;

    // 将面具数据回显到表单中
    document.getElementById('pIdInput').value = persona.realName || '';
    document.getElementById('pSexInput').value = persona.sex || '';
    document.getElementById('pPersonaInput').value = persona.persona || '';
    
    const avatarUpload = document.getElementById('pAvatarUpload');
    if (persona.avatarUrl) {
        avatarUpload.style.backgroundImage = `url(${persona.avatarUrl})`;
        avatarUpload.innerText = '';
    } else {
        avatarUpload.style.backgroundImage = '';
        avatarUpload.innerText = '上传头像';
    }

    document.getElementById('personaPanel').style.display = 'flex';
}

// 3. 保存面具 (支持新建和更新)
function savePersona() {
    const realName = document.getElementById('pIdInput').value.trim() || '未命名';
    const sex = document.getElementById('pSexInput').value.trim();
    const personaText = document.getElementById('pPersonaInput').value.trim();
    const avatarBg = document.getElementById('pAvatarUpload').style.backgroundImage;
    
    let avatarUrl = '';
    if (avatarBg && avatarBg !== 'none') {
        avatarUrl = avatarBg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    }

    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');

    if (currentEditingPersonaId) {
        // 编辑模式：找到并更新现有面具
        const index = personas.findIndex(p => p.id === currentEditingPersonaId);
        if (index !== -1) {
            personas[index].realName = realName;
            personas[index].sex = sex;
            personas[index].persona = personaText;
            personas[index].avatarUrl = avatarUrl;
        }
    } else {
        // 新建模式：创建新面具
        const newPersona = {
            id: Date.now().toString(),
            realName: realName,
            sex: sex,
            persona: personaText,
            avatarUrl: avatarUrl
        };
        personas.push(newPersona);
    }

    ChatDB.setItem('chat_personas', JSON.stringify(personas));
    
    // 移除强制同步账号头像的逻辑，实现面具头像与账号头像分离

    closePersonaPanel();

    // 如果当前停留在微信主页，保存后立即刷新页面数据和聊天列表
    if (document.getElementById('wechatPanel').style.display === 'flex') {
        renderMePage();
        if (typeof renderChatList === 'function') renderChatList();
        // 新增：同步刷新朋友圈资料
        if (typeof renderMoments === 'function') renderMoments();
    }
    
    if (document.getElementById('maskManagerPanel') && document.getElementById('maskManagerPanel').style.display === 'flex') {
        renderMaskManagerList();
    }
}

// --- 注册/登录页面切换逻辑 ---
const chatRegisterContainer = document.getElementById('chatRegisterContainer');
const chatLoginContainer = document.getElementById('chatLoginContainer');
const chatHeaderTitle = document.getElementById('chatHeaderTitle');

function switchChatMode(mode) {
    if (mode === 'login') {
        chatRegisterContainer.style.display = 'none';
        chatLoginContainer.style.display = 'flex';
        chatHeaderTitle.innerHTML = 'Login';
    } else {
        chatLoginContainer.style.display = 'none';
        chatRegisterContainer.style.display = 'flex';
        chatHeaderTitle.innerHTML = 'Sign Up';
    }
}
// ==========================================
// Char 感知系统：记录 User 操作 Char 手机的行为
// ==========================================
function injectCharPerception(actionType, detail, targetId = null) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let allEntities = getAllEntities();
    const currentEntity = allEntities.find(e => e.id === currentLoginId);
    
    // 只有当当前登录的是 Char 时才触发感知 (说明是 User 在代打)
    if (!currentEntity || currentEntity.isAccount) return;

    // 找到主 User 账号 (假设系统里至少有一个真实用户账号)
    const mainUser = allEntities.find(e => e.isAccount);
    if (!mainUser) return;

    let targetName = '';
    if (targetId) {
        const targetEntity = allEntities.find(e => e.id === targetId);
        targetName = targetEntity ? (targetEntity.netName || targetEntity.name) : '未知';
    }

    let actionDesc = '';
    if (actionType === 'send_msg') actionDesc = `给 ${targetName} 发送了消息：“${detail}”`;
    else if (actionType === 'send_img') actionDesc = `给 ${targetName} 发送了一张图片`;
    else if (actionType === 'send_voice') actionDesc = `给 ${targetName} 发送了一条语音：“${detail}”`;
    else if (actionType === 'send_emoji') actionDesc = `给 ${targetName} 发送了一个表情包：[${detail}]`;
    else if (actionType === 'send_family_card') actionDesc = `给 ${targetName} 发送/索要了亲属卡`;
    else if (actionType === 'send_transfer') actionDesc = `给 ${targetName} 转账了 ¥${detail}`;
    else if (actionType === 'delete_friend') actionDesc = `在通讯录中删除了好友 ${targetName}`;
    else if (actionType === 'post_moment') actionDesc = `发布了一条朋友圈动态：“${detail}”`;
    else if (actionType === 'delete_moment') actionDesc = `删除了一条朋友圈动态`;
    else if (actionType === 'comment_moment') actionDesc = `在朋友圈发表了评论：“${detail}”`;
    else if (actionType === 'change_name') actionDesc = `修改了自己的网名为：“${detail}”`;
    else if (actionType === 'change_sign') actionDesc = `修改了自己的个性签名为：“${detail}”`;

    // 注入到 Char 和 主 User 的聊天记录中 (作为隐藏系统消息)
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${mainUser.id}`) || '[]');
    history.push({
        role: 'user', type: 'hidden_system',
        content: `[系统感知/上帝视角：${mainUser.netName || 'User'} 刚刚拿你的手机进行了操作：${actionDesc}。请在接下来的聊天中，根据你的人设对此做出反应。]`,
        timestamp: Date.now()
    });
    ChatDB.setItem(`chat_history_${currentLoginId}_${mainUser.id}`, JSON.stringify(history));
    
    // 双向同步给 User (让 User 也能在后台数据里看到)
    let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${mainUser.id}_${currentLoginId}`) || '[]');
    targetHistory.push({
        role: 'char', type: 'hidden_system',
        content: `[系统感知/上帝视角：你刚刚操作了 ${currentEntity.name} 的手机，执行了：${actionDesc}。对方可能已经察觉到了。]`,
        timestamp: Date.now()
    });
    ChatDB.setItem(`chat_history_${mainUser.id}_${currentLoginId}`, JSON.stringify(targetHistory));
}

// ==========================================
// 气泡弹窗与列表渲染逻辑
// ==========================================
const chatPresetPopup = document.getElementById('chatPresetPopup');
let isChatPresetEditing = false;
let currentPopupMode = 'register'; // 'register' 或 'login'
let currentSelectedPersonaId = null; // 注册时选中的面具ID

// 修改：点击注册区的面具绑定，或者登录区的头像，都会触发此函数
function toggleChatPresetPopup(mode = 'register') {
    currentPopupMode = mode;
    chatPresetPopup.classList.toggle('show');
    
    if (chatPresetPopup.classList.contains('show')) {
        isChatPresetEditing = false;
        chatPresetPopup.classList.remove('is-editing');
        document.getElementById('chatPresetEditBtn').innerText = 'EDIT';
        
        // 根据模式修改弹窗标题
        const headerTitle = document.querySelector('#chatPresetPopup .preset-header span:first-child');
        if (mode === 'login') {
            headerTitle.innerText = '已绑定账号';
            document.querySelector('#chatPresetPopup .preset-footer').style.display = 'none'; // 登录时不显示创建面具
        } else {
            headerTitle.innerText = '用户面具';
            document.querySelector('#chatPresetPopup .preset-footer').style.display = 'flex';
        }
        
        renderChatPersonas(); // 刷新列表
    }
}

function toggleChatPresetEditMode(e) {
    e.stopPropagation();
    isChatPresetEditing = !isChatPresetEditing;
    const editBtn = document.getElementById('chatPresetEditBtn');
    if (isChatPresetEditing) {
        chatPresetPopup.classList.add('is-editing');
        editBtn.innerText = 'Done';
    } else {
        chatPresetPopup.classList.remove('is-editing');
        editBtn.innerText = 'Edit';
    }
}

// 渲染列表 (区分注册和登录)
function renderChatPersonas() {
    const listEl = document.getElementById('chatPresetList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (currentPopupMode === 'register') {
        // 注册模式：显示所有面具
        let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
        if (personas.length === 0) {
            listEl.innerHTML = '<div style="padding: 15px; text-align: center; color: #aaa; font-size: 12px;">暂无面具，请先创建</div>';
            return;
        }
        personas.forEach(p => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.onclick = () => selectMaskForRegister(p);
            item.innerHTML = `
                <span class="preset-item-name">真名: ${p.realName}</span>
                <div class="preset-delete-btn" onclick="deletePersona('${p.id}', event)">-</div>
            `;
            listEl.appendChild(item);
        });
    } else {
        // 登录模式：显示已绑定的账号
        let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        if (accounts.length === 0) {
            listEl.innerHTML = '<div style="padding: 15px; text-align: center; color: #aaa; font-size: 12px;">暂无已绑定的账号</div>';
            return;
        }
        accounts.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.onclick = () => selectAccountForLogin(acc);
            item.innerHTML = `
                <span class="preset-item-name">网名: ${acc.netName}</span>
                <div class="preset-delete-btn" onclick="deleteAccount('${acc.id}', event)">-</div>
            `;
            listEl.appendChild(item);
        });
    }
}

// 注册时选择面具
function selectMaskForRegister(persona) {
    if (isChatPresetEditing) return;
    currentSelectedPersonaId = persona.id;
    
    const avatarEl = document.getElementById('regSelectedAvatar');
    if (persona.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${persona.avatarUrl})`;
        avatarEl.innerHTML = ''; 
    } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.backgroundColor = '#333'; 
        avatarEl.innerHTML = '';
    }
    document.getElementById('regSelectedName').innerText = '已绑定: ' + persona.realName;
    chatPresetPopup.classList.remove('show');
}

// 登录时选择账号
function selectAccountForLogin(account) {
    if (isChatPresetEditing) return;
    
    // 填充头像和网名
    const avatarEl = document.getElementById('loginSelectedAvatar');
    if (account.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${account.avatarUrl})`;
        avatarEl.innerHTML = ''; 
    } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.backgroundColor = '#333'; 
        avatarEl.innerHTML = '';
    }
    document.getElementById('loginSelectedName').innerText = account.netName;
    
    // 填充账号密码
    document.getElementById('loginAccount').value = account.account;
    document.getElementById('loginPassword').value = account.password;
    
    chatPresetPopup.classList.remove('show');
}

// 删除面具
function deletePersona(id, e) {
    e.stopPropagation();
    if (confirm('确定要删除这个面具吗？')) {
        let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
        personas = personas.filter(p => p.id !== id);
        ChatDB.setItem('chat_personas', JSON.stringify(personas));
        renderChatPersonas();
    }
}

// 删除账号
function deleteAccount(id, e) {
    e.stopPropagation();
    if (confirm('确定要删除这个账号记录吗？')) {
        let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        accounts = accounts.filter(a => a.id !== id);
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
        
        // 核心修复：如果删除的是当前正在登录的账号，强制退出登录
        if (ChatDB.getItem('current_login_account') === id) {
            ChatDB.removeItem('current_login_account');
        }
        
        renderChatPersonas();
    }
}

// 点击空白处关闭弹窗
document.addEventListener('click', (e) => {
    const bindContainers = document.querySelectorAll('.mask-bind-container');
    let clickedOnBind = false;
    bindContainers.forEach(el => { if (el.contains(e.target)) clickedOnBind = true; });
    
    if (chatPresetPopup && chatPresetPopup.classList.contains('show') && 
        !chatPresetPopup.contains(e.target) && 
        chatHeaderTitle && !chatHeaderTitle.contains(e.target) && 
        !clickedOnBind) {
        chatPresetPopup.classList.remove('show');
    }
});

// ==========================================
// 注册/登录 提交与持久化逻辑
// ==========================================

function enterWechat(accountId) {
    if (accountId) {
        ChatDB.setItem('current_login_account', accountId); // 保存登录状态
    }
    chatPanel.style.display = 'none';
    wechatPanel.style.display = 'flex';
    renderMePage(); // 渲染个人主页数据
    renderChatList(); // 新增：进入微信面板时渲染列表
    renderContactList(); // 新增：进入微信面板时渲染通讯录
}

// 渲染个人主页 (Me)
function renderMePage() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;
    
    // 核心修改：从所有实体中获取当前登录人信息（兼容 Char 登录）
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === currentLoginId);
    if (!account) return;

    // 填充网名
    document.getElementById('meName').innerText = account.netName || account.name || '未命名';
    const meNameTop = document.getElementById('meNameTop');
    if(meNameTop) meNameTop.innerText = account.netName || '未命名';
    
    // 填充账号 (作为编号)
    const accountNoEl = document.getElementById('meAccountNo');
    if(accountNoEl) accountNoEl.innerText = account.account || '0000000';
    
    // 填充个性签名
    const signEl = document.getElementById('meSign');
    if(signEl) signEl.innerText = account.signature || '这个人很懒，什么都没写~';
    
    // 填充头像
    const avatarEl = document.getElementById('meAvatar');
    if (account.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${account.avatarUrl})`;
    } else {
        avatarEl.style.backgroundImage = 'none';
    }
}

// 修改账号头像
function triggerMeAvatarUpload() {
    document.getElementById('meAvatarInput').click();
}

function handleMeAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgUrl = e.target.result;
        const currentLoginId = ChatDB.getItem('current_login_account');
        if (!currentLoginId) return;
        
        let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        const accountIndex = accounts.findIndex(a => a.id === currentLoginId);
        if (accountIndex !== -1) {
            accounts[accountIndex].avatarUrl = imgUrl;
            ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
            
            // 刷新UI
            renderMePage();
            if (typeof renderChatList === 'function') renderChatList();
            if (typeof renderMoments === 'function') renderMoments();
            
            // 如果在聊天室，同步刷新聊天室顶部头像
            const charAvatarEl = document.getElementById('crHeaderAvatarMe');
            if (charAvatarEl) charAvatarEl.style.backgroundImage = `url('${imgUrl}')`;

            // 新增：同步刷新 musicAPP 和 查手机 的头像
            if (typeof renderMusicMePage === 'function') renderMusicMePage();
            if (typeof updateCapsuleUI === 'function') updateCapsuleUI();
            
            // 刷新一起听歌的头像
            const mpListenTogetherAvatar1 = document.getElementById('mpListenTogetherAvatar1');
            if (mpListenTogetherAvatar1) mpListenTogetherAvatar1.style.backgroundImage = `url('${imgUrl}')`;
            const mpBigAvatar1 = document.getElementById('mpBigAvatar1');
            if (mpBigAvatar1) mpBigAvatar1.style.backgroundImage = `url('${imgUrl}')`;
            const miniAvatar1 = document.getElementById('miniAvatar1');
            if (miniAvatar1) miniAvatar1.style.backgroundImage = `url('${imgUrl}')`;
            
            // 刷新查手机的头像
            const phoneWechatApp = document.getElementById('phoneWechatApp');
            if (phoneWechatApp && phoneWechatApp.classList.contains('show')) {
                if (typeof renderPwaChatList === 'function') renderPwaChatList();
                if (typeof renderPwaContactList === 'function') renderPwaContactList();
            }
            
            alert('账号头像修改成功！');
        }
    }
    reader.readAsDataURL(file);
    event.target.value = '';
}

// 编辑网名
function editMeName() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const accountIndex = accounts.findIndex(a => a.id === currentLoginId);
    if (accountIndex === -1) return;

    const currentName = accounts[accountIndex].netName || '';
    const newName = prompt('请输入新的网名：', currentName);
    
    if (newName !== null && newName.trim() !== '') {
        accounts[accountIndex].netName = newName.trim();
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
        
        // 更新 UI
        document.getElementById('meName').innerText = newName.trim();
        const meNameTop = document.getElementById('meNameTop');
        if(meNameTop) meNameTop.innerText = newName.trim();

        // --- 新增：触发 Char 感知系统 ---
        injectCharPerception('change_name', newName.trim());
        // -------------------------------
    }
}

// 编辑个性签名
function editMeSign() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const accountIndex = accounts.findIndex(a => a.id === currentLoginId);
    if (accountIndex === -1) return;

    const currentSign = accounts[accountIndex].signature || '';
    const newSign = prompt('请输入新的个性签名：', currentSign);
    
    if (newSign !== null) {
        accounts[accountIndex].signature = newSign.trim();
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
        const signEl = document.getElementById('meSign');
        if(signEl) signEl.innerText = newSign.trim() || '这个人很懒，什么都没写~';

        // --- 新增：触发 Char 感知系统 ---
        injectCharPerception('change_sign', newSign.trim());
        // -------------------------------
    }
}


// 每秒更新一次时间
setInterval(() => {
    if (document.getElementById('tab-me').style.display === 'flex') {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const timeEl = document.getElementById('meCurrentTime');
        if(timeEl) timeEl.innerText = timeStr;
    }
}, 1000);

// 注册逻辑
const doRegisterBtn = document.getElementById('doRegisterBtn');
if (doRegisterBtn) {
    doRegisterBtn.addEventListener('click', () => {
        if (!currentSelectedPersonaId) return alert('请先点击上方选择要绑定的面具！');
        
        const netName = document.getElementById('regNetName').value.trim();
        const account = document.getElementById('regAccount').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const isAgreed = document.getElementById('regAgreement').checked;
        
        if (!netName || !account || !password) return alert('请填写完整的注册信息！');
        if (!isAgreed) return alert('请先阅读并勾选同意服务协议！');
        
        // 【新增】：检查账号是否已存在
        let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        if (accounts.some(a => a.account === account)) {
            return alert('该账号已被注册，请更换一个账号！');
        }
        
        const personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
        const persona = personas.find(p => p.id === currentSelectedPersonaId);
        
        const newAccount = {
            id: Date.now().toString(),
            personaId: currentSelectedPersonaId,
            netName: netName,
            account: account,
            password: password,
            avatarUrl: persona ? persona.avatarUrl : ''
        };
        
        accounts.push(newAccount);
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
        
        alert('注册成功！已为您绑定面具并自动登录。');
        enterWechat(newAccount.id); // 注册完直接登录
    });
}

// 登录逻辑
const doLoginBtn = document.getElementById('doLoginBtn');
if (doLoginBtn) {
    doLoginBtn.addEventListener('click', () => {
        const account = document.getElementById('loginAccount').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!account || !password) return alert('请输入账号和密码！');
        
        // 核心修改：在所有实体（User 和 Char）中查找匹配的账号密码
        let allEntities = getAllEntities();
        const validAccount = allEntities.find(a => a.account === account && a.password === password);
        
        if (validAccount) {
            enterWechat(validAccount.id);
        } else {
            alert('账号或密码错误！');
        }
    });
}

// ==========================================
// 设置与切换账号面板 (学生证样式)
// ==========================================
const switchAccountPanel = document.getElementById('switchAccountPanel');

function openSwitchAccountPanel() {
    switchAccountPanel.style.display = 'flex';
    renderAccountCards();
}

function closeSwitchAccountPanel() {
    switchAccountPanel.style.display = 'none';
}

function logoutWechat() {
    if (confirm('确定要退出当前登录吗？')) {
        // 清除登录状态
        ChatDB.removeItem('current_login_account');
        
        // 关闭面板，回到登录页
        switchAccountPanel.style.display = 'none';
        document.getElementById('wechatPanel').style.display = 'none';
        document.getElementById('chatPanel').style.display = 'flex';
        switchChatMode('login');
    }
}

function renderAccountCards() {
    const listEl = document.getElementById('accountCardList');
    listEl.innerHTML = '';
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
    
    // 核心修改：收集需要显示的账号 ID（所有真实用户 + 当前登录账号 + 关联账号）
    let displayIds = new Set();
    accounts.forEach(a => displayIds.add(a.id));
    if (currentLoginId) displayIds.add(currentLoginId);
    linkedAccounts.forEach(id => displayIds.add(id));

    let allEntities = getAllEntities();
    let displayEntities = [];
    displayIds.forEach(id => {
        const entity = allEntities.find(e => e.id === id);
        if (entity) displayEntities.push(entity);
    });

    if (displayEntities.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 20px;">暂无绑定的账号</div>';
        return;
    }

    // 排序：当前登录的账号永远排在第一个
    displayEntities.sort((a, b) => {
        if (a.id === currentLoginId) return -1;
        if (b.id === currentLoginId) return 1;
        return 0;
    });

    displayEntities.forEach(acc => {
        const isCurrent = acc.id === currentLoginId;
        const isLinked = linkedAccounts.includes(acc.id) && !isCurrent;
        const isUser = acc.isAccount;
        
        // 将账号的 id (时间戳) 转换为可读的日期格式
        let dateString = '未知时间';
        if (!isNaN(parseInt(acc.id))) {
            const createDate = new Date(parseInt(acc.id));
            dateString = createDate.getFullYear() + '-' + 
                           String(createDate.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(createDate.getDate()).padStart(2, '0') + ' ' + 
                           String(createDate.getHours()).padStart(2, '0') + ':' + 
                           String(createDate.getMinutes()).padStart(2, '0');
        }

        const card = document.createElement('div');
        // 移除 CSS 中自带的 is-current 类，防止自带的 ::after 伪元素干扰，我们用 JS 动态生成标签
        card.className = `student-card-wrapper`;
        if (isCurrent) {
            card.style.borderColor = '#111';
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        }
        
        // 点击卡片快捷切换账号
        card.onclick = () => {
            if (!isCurrent) {
                ChatDB.setItem('current_login_account', acc.id);
                // 核心修改：切换账号后，全局刷新所有数据面板
                renderMePage(); 
                if (typeof renderChatList === 'function') renderChatList();
                if (typeof renderContactList === 'function') renderContactList();
                if (typeof renderMoments === 'function') renderMoments();
                closeSwitchAccountPanel();
                alert(`已快捷切换至账号: ${acc.netName || acc.name}`);
            }
        };

        // 动态生成右上角身份标签
        let tagHtml = '';
        if (isCurrent) {
            tagHtml = `<div style="position: absolute; top: -10px; right: 10px; background: #111; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; z-index: 10;">当前登录</div>`;
        } else if (isLinked) {
            tagHtml = `<div style="position: absolute; top: -10px; right: 10px; background: #007AFF; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; z-index: 10;">关联账号</div>`;
        } else if (!isUser) {
            tagHtml = `<div style="position: absolute; top: -10px; right: 10px; background: #ff9500; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; z-index: 10;">角色账号</div>`;
        }

        card.innerHTML = `
            ${tagHtml}
            <div class="student-card-inner">
                <div class="sc-avatar" style="background-image: url('${acc.avatarUrl || ''}');"></div>
                <div class="sc-info">
                    <div class="sc-row">
                        <!-- 用户图标 -->
                        <svg class="sc-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        <span class="sc-text">@${acc.netName || acc.name}</span>
                    </div>
                    <div class="sc-row">
                        <!-- 时钟图标 -->
                        <svg class="sc-icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                        <span class="sc-text italic">${dateString}</span>
                    </div>
                    <div class="sc-row">
                        <!-- 账号/ID卡图标 -->
                        <svg class="sc-icon" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-9-2h8v-2h-8v2zm0-4h8v-2h-8v2zm0-4h8V7h-8v2zM5 15h4v-2H5v2zm0-4h4V9H5v2zm0-4h4V5H5v2z"/></svg>
                        <span class="sc-text">Account: ${acc.account || '未生成'}</span>
                    </div>
                </div>
            </div>
        `;
        listEl.appendChild(card);
    });
}

// ==========================================
// 人设编辑页 头像与ID同步逻辑
// ==========================================
function triggerPersonaAvatarUpload() { document.getElementById('pAvatarInput').click(); }

function handlePersonaAvatarChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = `url(${e.target.result})`;
            const squareAvatar = document.getElementById('pAvatarUpload');
            if (squareAvatar) {
                squareAvatar.style.backgroundImage = imgUrl;
                squareAvatar.innerText = ''; 
                squareAvatar.style.border = 'none';
            }
            // 【修复】：增加判空，防止旧版 UI 元素不存在导致报错卡死
            const floatAvatar = document.getElementById('pAvatarFloat');
            if (floatAvatar) {
                floatAvatar.style.backgroundImage = imgUrl;
            }
        }
        reader.readAsDataURL(file);
    }
}

function syncPersonaId() {
    const inputVal = document.getElementById('pIdInput').value;
    document.getElementById('pIdFloat').innerText = 'Real Name: ' + (inputVal || '未命名');
}
// ==========================================
// Wechat 界面交互逻辑
// ==========================================
// 切换底部 Tab
function switchWechatTab(tabName) {
    // 1. 隐藏所有 tab 内容
    document.querySelectorAll('.wechat-tab-content').forEach(el => {
        el.style.display = 'none';
    });
    
    // 2. 移除所有 nav item 的 active 状态
    document.querySelectorAll('.wechat-nav-item').forEach(el => {
        el.classList.remove('active');
    });

    // 3. 显示目标 tab 内容
    document.getElementById('tab-' + tabName).style.display = 'flex';
    
    // 4. 激活对应的 nav item 并修改顶部标题
    const navItems = document.querySelectorAll('.wechat-nav-item');
    let title = 'Chat';
    
    if (tabName === 'chat') { 
        navItems[0].classList.add('active'); 
        title = 'Chat'; 
        if (typeof renderChatList === 'function') renderChatList(); // 每次切回聊天列表强制刷新
    } else if (tabName === 'contacts') { 
        navItems[1].classList.add('active'); 
        title = 'Contacts'; 
        if (typeof renderContactList === 'function') renderContactList(); // 每次切回通讯录强制刷新
    } else if (tabName === 'moment') { 
        navItems[2].classList.add('active'); 
        title = 'Moment'; 
    } else if (tabName === 'me') { 
        navItems[3].classList.add('active'); 
        title = 'Me'; 
    }
    // 更新顶部悬浮胶囊标题
    document.getElementById('wechatHeaderTitle').innerText = title;
    
    // 根据 Tab 切换右上角按钮
    const rightBtn = document.getElementById('wechatHeaderRightBtn');
    const searchBtn = document.getElementById('wechatSearchBtn'); // 获取搜索按钮
    const charGenBtn = document.getElementById('charSocialGenBtn'); // 获取新的生成按钮
    
    if (tabName === 'chat') {
        rightBtn.innerHTML = '';
        rightBtn.onclick = null;
        rightBtn.style.visibility = 'hidden';
        if (searchBtn) searchBtn.style.display = 'flex'; // Chat 页面显示搜索按钮
        
        // 控制专属生成按钮的显示
        const currentLoginId = ChatDB.getItem('current_login_account');
        let allEntities = getAllEntities();
        const me = allEntities.find(a => a.id === currentLoginId);
        if (charGenBtn) {
            charGenBtn.style.display = (me && !me.isAccount) ? 'flex' : 'none';
        }
    } else if (tabName === 'contacts') {
        rightBtn.innerHTML = '';
        rightBtn.onclick = null;
        rightBtn.style.visibility = 'hidden';
        if (searchBtn) searchBtn.style.display = 'none';
    } else if (tabName === 'me') {
        rightBtn.innerHTML = 'EDIT';
        rightBtn.style.fontSize = '15px';
        rightBtn.onclick = editCurrentPersona;
        rightBtn.style.visibility = 'visible';
        if (searchBtn) searchBtn.style.display = 'none'; // 其他页面隐藏搜索按钮
    } else if (tabName === 'moment') {
        // 朋友圈页面右上角显示相机图标 (改为浅灰色 #bbb)
        rightBtn.innerHTML = '<svg viewBox="0 0 24 24" width="25" height="25" stroke="#bbb" stroke-width="2" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
        rightBtn.onclick = openMomentPostPanel;
        rightBtn.style.visibility = 'visible';
        if (searchBtn) searchBtn.style.display = 'none';
    } else {
        rightBtn.innerHTML = '';
        rightBtn.onclick = null;
        rightBtn.style.visibility = 'hidden';
        if (searchBtn) searchBtn.style.display = 'none'; // 其他页面隐藏搜索按钮
    }
}

// ==========================================
// 角色库 (Char Library) 逻辑
// ==========================================
function openCharLibraryPanel() {
    document.getElementById('charLibraryPanel').style.display = 'flex';
    renderCharLibrary(); // 每次打开都重新读取并渲染
}

function closeCharLibraryPanel() {
    document.getElementById('charLibraryPanel').style.display = 'none';
}

function renderCharLibrary() {
    const listEl = document.getElementById('charLibraryList');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    // 将容器改为单列布局
    listEl.style.display = 'flex';
    listEl.style.flexDirection = 'column';
    listEl.style.gap = '20px';
    
    let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    // 默认分组显示全部，其他分组进行过滤
    let chars = currentCharGroupFilter === '默认分组' ? allChars : allChars.filter(c => c.group === currentCharGroupFilter);
    
    if (chars.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">暂无角色，点击右上角 Create 创建</div>';
        return;
    }

    chars.forEach(char => {
        // 格式化创建时间
        const createDate = new Date(parseInt(char.id));
        const dateStr = `${createDate.getFullYear()}.${String(createDate.getMonth()+1).padStart(2,'0')}.${String(createDate.getDate()).padStart(2,'0')}`;

        const card = document.createElement('div');
        card.className = 'char-id-card';
        card.innerHTML = `
            <div class="id-card-bg">PERSONAL INFORMATION</div>
            <div class="id-card-content">
                <div class="id-card-left">
                    <div class="id-section">
                        <div class="id-title"><span>01</span> 创建DATE #</div>
                        <div class="id-text">${dateStr}</div>
                    </div>
                    <div class="id-section">
                        <div class="id-title"><span>04</span> 分组GROUP #</div>
                        <div class="id-text">${char.group || '默认分组'}</div>
                    </div>
                </div>
                
                <div class="id-card-center">
                    <div class="id-avatar-wrap">
                        <div class="id-avatar" style="background-image: url('${char.avatarUrl || ''}');"></div>
                    </div>
                    <div class="id-name-wrap">
                        <svg class="quote-icon" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
                        <span class="id-name-text">${char.name}</span>
                        <svg class="quote-icon" viewBox="0 0 24 24"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.57-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z"/></svg>
                    </div>
                </div>
                
                <div class="id-card-right">
                    <div class="id-section" style="align-items: flex-end;">
                        <div class="id-title"><span>02</span> 性别SEX #</div>
                        <div class="id-text" style="text-align: right;">${char.sex || '未知'}</div>
                    </div>
                    <div class="id-section" style="align-items: flex-end;">
                        <div class="id-title"><span>03</span> 场景SCENE #</div>
                        <div class="id-text line-clamp-2" style="text-align: right;">${char.scenario || '暂无场景'}</div>
                    </div>
                </div>
            </div>
            <div class="id-card-bottom" style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; font-style: normal; padding-left: 15px; padding-right: 15px;">
                <div onclick="event.stopPropagation(); openSecretModal('${char.id}')" class="p-capsule black" style="cursor: pointer; font-size: 12px; padding: 6px 18px; display: inline-block; letter-spacing: 1px; background-color: #111;">查看（Check）</div>
                <div onclick="event.stopPropagation(); deleteChar('${char.id}')" class="p-capsule black" style="cursor: pointer; font-size: 12px; padding: 6px 18px; display: inline-block; letter-spacing: 1px; background-color: #888;">删除（Delete）</div>
            </div>
        `;

        // 点击整个卡片直接进入全屏编辑页面
        card.onclick = () => {
            openCharEditPanel(char.id);
        };
        listEl.appendChild(card);
    });
}

// --- 角色编辑面板逻辑 ---
let currentEditingCharId = null; // 全局变量：记录当前正在编辑的角色ID
let currentSelectedWbEntries = []; // 记录当前选中的世界书条目 ID

function openCharEditPanel(charId = null) {
    currentEditingCharId = charId; 
    currentSelectedWbEntries = [];
    
    document.getElementById('charNameInput').value = '';
    document.getElementById('charSexInput').value = '';
    document.getElementById('charDescInput').value = '';
    document.getElementById('charFirstMsgInput').value = '';
    document.getElementById('charScenarioInput').value = '';
    document.getElementById('charWbSelectText').innerText = '未绑定...';
    
    const avatarUpload = document.getElementById('charAvatarUpload');
    avatarUpload.style.backgroundImage = '';
    avatarUpload.innerText = '上传头像';
    
    if (typeof renderCharGroups === 'function') renderCharGroups();
    document.getElementById('char-edit-header-group').innerText = typeof currentCharGroupFilter !== 'undefined' ? currentCharGroupFilter : '默认分组';

    if (charId) {
        let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        const char = chars.find(c => c.id === charId);
        if (char) {
            document.getElementById('charNameInput').value = char.name || '';
            document.getElementById('charSexInput').value = char.sex || '';
            document.getElementById('charDescInput').value = char.description || '';
            document.getElementById('charFirstMsgInput').value = char.firstMessage || '';
            document.getElementById('charScenarioInput').value = char.scenario || '';
            document.getElementById('char-edit-header-group').innerText = char.group || '默认分组';
            
            if (char.wbEntries && Array.isArray(char.wbEntries)) {
                // 修改点：读取当前真实存在的世界书数据，过滤掉已经被删除的废弃 ID
                let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
                let validWbIds = wbData.entries.map(e => e.id);
                
                currentSelectedWbEntries = char.wbEntries.filter(id => validWbIds.includes(id));
                
                if (currentSelectedWbEntries.length > 0) {
                    document.getElementById('charWbSelectText').innerText = `已选择 ${currentSelectedWbEntries.length} 个条目`;
                    document.getElementById('charWbSelectText').style.color = '#333';
                    document.getElementById('charWbSelectText').style.fontWeight = 'bold';
                } else {
                    document.getElementById('charWbSelectText').innerText = '未绑定...';
                    document.getElementById('charWbSelectText').style.color = '#888';
                    document.getElementById('charWbSelectText').style.fontWeight = 'normal';
                }
            }
            
            if (char.avatarUrl) {
                avatarUpload.style.backgroundImage = `url(${char.avatarUrl})`;
                avatarUpload.innerText = '';
            }
        }
    }
    
    document.getElementById('charEditPanel').style.display = 'flex';
}

function closeCharEditPanel() {
    document.getElementById('charEditPanel').style.display = 'none';
}

function saveChar() {
    const name = document.getElementById('charNameInput').value.trim();
    const sex = document.getElementById('charSexInput').value.trim();
    const desc = document.getElementById('charDescInput').value.trim();
    const firstMsg = document.getElementById('charFirstMsgInput').value.trim();
    const scenario = document.getElementById('charScenarioInput').value.trim();
    const group = document.getElementById('char-edit-header-group').innerText || '默认分组';
    
    if (!name) {
        alert('请输入角色名称！');
        return;
    }

    const avatarBg = document.getElementById('charAvatarUpload').style.backgroundImage;
    let avatarUrl = '';
    if (avatarBg && avatarBg !== 'none') {
        avatarUrl = avatarBg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    }

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');

    if (currentEditingCharId) {
        const index = chars.findIndex(c => c.id === currentEditingCharId);
        if (index !== -1) {
            chars[index] = { 
                ...chars[index], 
                name, sex, description: desc, firstMessage: firstMsg, scenario, avatarUrl, group, wbEntries: currentSelectedWbEntries 
            };
        }
    } else {
        const newChar = {
            id: Date.now().toString(),
            name: name,
            sex: sex,
            description: desc,
            firstMessage: firstMsg,
            scenario: scenario,
            avatarUrl: avatarUrl,
            group: group,
            wbEntries: currentSelectedWbEntries,
            netName: '', account: '', password: '' // 初始为空，由 Secret 弹窗手动生成
        };
        chars.push(newChar);
    }

    ChatDB.setItem('chat_chars', JSON.stringify(chars));
    alert('角色保存成功！');
    closeCharEditPanel();
    
    // 【修复】：保存后全局刷新相关 UI，确保头像第一时间更新
    if (typeof renderCharLibrary === 'function') renderCharLibrary();
    if (typeof renderChatList === 'function') renderChatList();
    if (typeof renderContactList === 'function') renderContactList();
    
    // 如果当前正在和这个角色聊天，同步更新聊天室顶部的头像
    if (currentChatRoomCharId === (currentEditingCharId || newChar.id)) {
        document.getElementById('crHeaderAvatarChar').style.backgroundImage = `url('${avatarUrl || ''}')`;
        renderChatHistory(currentChatRoomCharId, true);
    }
}

function handleCharAvatarChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = `url(${e.target.result})`;
            const squareAvatar = document.getElementById('charAvatarUpload');
            squareAvatar.style.backgroundImage = imgUrl;
            squareAvatar.innerText = ''; 
            squareAvatar.style.border = 'none';
        }
        reader.readAsDataURL(file);
    }
}
// ==========================================
// 角色编辑页标签切换逻辑
// ==========================================
function switchCharTab(tabName) {
    // 隐藏所有内容
    document.querySelectorAll('.char-tab-content').forEach(el => el.style.display = 'none');
    // 重置所有按钮颜色为灰色
    document.querySelectorAll('.char-tab-btn').forEach(el => {
        el.classList.remove('black');
        el.classList.add('gray');
    });
    
    // 显示对应内容
    document.getElementById('charTab-' + tabName).style.display = 'flex';
    // 将点击的按钮设为黑色
    document.getElementById('btn-char-' + tabName).classList.remove('gray');
    document.getElementById('btn-char-' + tabName).classList.add('black');
}

// ==========================================
// 渲染会话列表与通讯录
// ==========================================
// ==========================================
// 互动标识与会话管理逻辑 (QQ/iOS 风格)
// ==========================================
let sessionPressTimer;
let currentActionSessionId = null;

// --- 高质量 SVG 路径定义 (用户精选版) ---
const SVG_PATHS = {
    FIRE: "M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.22.1-.47.04-.64-.12-.06-.05-.1-.1-.15-.17-1.1-1.43-1.26-3.59-.39-5.19-1.42.54-2.48 1.64-3.06 3.11-.9 2.02-.48 4.52 1.04 6.06 2.29 2.31 5.92 2.5 8.47.44 2.51-2.02 3.5-5.42 1.6-8.3z",
    BIG_FIRE: "M12 23c4.418 0 8-3.582 8-8 0-3.285-2.007-6.113-4.886-7.315.213 1.124-.12 2.34-.94 3.22-.82.88-2.036 1.213-3.174 1.094V12c0-3.866-3.134-7-7-7 0 3.866 3.134 7 7 7v3c0 4.418 3.582 8 8 8z",
    BOAT: "M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z",
    SHIP: "M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z",    SPLASH: "M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z",
    LUCK: "M12,2C9.5,2 7.5,4 7.5,6.5C7.5,7.4 7.8,8.2 8.2,8.9C7.5,8.5 6.7,8.2 5.8,8.2C3.3,8.2 1.3,10.2 1.3,12.7C1.3,15.2 3.3,17.2 5.8,17.2C6.7,17.2 7.5,16.9 8.2,16.5C7.8,17.2 7.5,18 7.5,18.9C7.5,21.4 9.5,23.4 12,23.4C14.5,23.4 16.5,21.4 16.5,18.9C16.5,18 16.2,17.2 15.8,16.5C16.5,16.9 17.3,17.2 18.2,17.2C20.7,17.2 22.7,15.2 22.7,12.7C22.7,10.2 20.7,8.2 18.2,8.2C17.3,8.2 16.5,8.5 15.8,8.9C16.2,8.2 16.5,7.4 16.5,6.5C16.5,4 14.5,2 12,2Z",
    RECORD: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"
};

// 新增：更新一起听歌互动数据
function updateMusicInteractionStats(charId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    // 内部辅助函数：双向更新
    function _updateSingleMusic(ownerId, targetId) {
        let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${ownerId}`) || '{}');
        if (!stats[targetId]) {
            stats[targetId] = { streak: 0, lastDate: '', count: 0, pinned: false, special: false, userLastMsg: false, charLastMsg: false, addedDate: new Date().toISOString().split('T')[0], littleLuck: false, wornBadge: null, musicStreak: 0, musicLastDate: '' };
        }

        const data = stats[targetId];
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (data.musicLastDate === yesterday) {
            data.musicStreak = (data.musicStreak || 0) + 1;
        } else if (data.musicLastDate !== today) {
            data.musicStreak = 1;
        }
        data.musicLastDate = today;

        ChatDB.setItem(`interaction_stats_${ownerId}`, JSON.stringify(stats));
    }

    _updateSingleMusic(currentLoginId, charId);
    _updateSingleMusic(charId, currentLoginId);
}

// 1. 更新互动数据 (包含小幸运逻辑)
function updateInteractionStats(charId, isUserSend = true) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    // 内部辅助函数：更新单边数据
    function _updateSingle(ownerId, targetId, isSelfSend) {
        let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${ownerId}`) || '{}');
        if (!stats[targetId]) {
            stats[targetId] = { streak: 0, lastDate: '', count: 0, pinned: false, special: false, userLastMsg: false, charLastMsg: false, addedDate: new Date().toISOString().split('T')[0], littleLuck: false, wornBadge: null };
        }

        const data = stats[targetId];
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        data.count++;
        if (isSelfSend) data.userLastMsg = today;
        else data.charLastMsg = today;

        // 判定连续互动
        if (data.userLastMsg === today && data.charLastMsg === today) {
            if (data.lastDate === yesterday) {
                data.streak++;
            } else if (data.lastDate !== today) {
                data.streak = 1;
            }
            data.lastDate = today;

            // 小幸运逻辑：如果是成为好友当天互发消息
            if (data.addedDate === today) {
                data.littleLuck = true;
            }
        }

        // 断聊逻辑：如果今天还没聊，且最后聊天日期早于昨天，小幸运消失
        if (data.lastDate && data.lastDate !== today && data.lastDate !== yesterday) {
            data.littleLuck = false;
        }

        ChatDB.setItem(`interaction_stats_${ownerId}`, JSON.stringify(stats));
    }

    // 双向更新：更新自己的视角
    _updateSingle(currentLoginId, charId, isUserSend);
    // 双向更新：更新对方的视角
    _updateSingle(charId, currentLoginId, !isUserSend);
}

// 2. 获取佩戴的互动标识 HTML
function getWornBadgeHtml(charId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}')[charId];
    if (!stats || !stats.wornBadge) return '';

    const badgeType = stats.wornBadge;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const isExtinguished = stats.lastDate && (stats.lastDate !== today && stats.lastDate !== yesterday);

    let path = "";
    let badgeClass = "";

    if (badgeType === 'luck' && stats.littleLuck && !isExtinguished) {
        path = SVG_PATHS.LUCK; badgeClass = "badge-luck";
    } else if (badgeType === 'fire' && stats.streak >= 3) {
        path = stats.streak >= 30 ? SVG_PATHS.BIG_FIRE : SVG_PATHS.FIRE;
        badgeClass = isExtinguished ? 'badge-fire dimmed' : (stats.streak >= 30 ? 'badge-fire big' : 'badge-fire');
    } else if (badgeType === 'boat' && stats.streak >= 7) {
        path = stats.streak >= 30 ? SVG_PATHS.SHIP : SVG_PATHS.BOAT;
        badgeClass = stats.streak >= 30 ? 'badge-ship' : 'badge-boat';
    } else if (badgeType === 'splash' && stats.count >= 100) {
        path = SVG_PATHS.SPLASH; badgeClass = "badge-splash";
    } else if (badgeType === 'record' && (stats.musicStreak || 0) >= 3) {
        path = SVG_PATHS.RECORD; badgeClass = "badge-record";
    } else {
        return ''; 
    }

    return `<div class="badge-icon ${badgeClass}" style="display:inline-flex; vertical-align:middle; margin-left:4px; width:16px; height:16px;"><svg viewBox="0 0 24 24"><path d="${path}"/></svg></div>`;
}

// --- 互动详情页逻辑 ---
function openInteractionDetailPanel() {
    renderInteractionDetail();
    document.getElementById('interactionDetailPanel').style.display = 'flex';
}

function closeInteractionDetailPanel() {
    document.getElementById('interactionDetailPanel').style.display = 'none';
}

function renderInteractionDetail() {
    const listEl = document.getElementById('interactionDetailList');
    const currentLoginId = ChatDB.getItem('current_login_account');
    const stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}')[currentChatRoomCharId] || { streak: 0, count: 0, littleLuck: false, wornBadge: null };
    
    listEl.innerHTML = '';

    const badgeConfigs = [
        { type: 'luck', name: '小幸运', desc: '成为新朋友当天互发消息获得', icon: 'badge-luck', path: SVG_PATHS.LUCK, condition: stats.littleLuck, val: '已点亮' },
        { type: 'fire', name: '畅聊火花', desc: '连续互动3天获得', icon: 'badge-fire', path: (stats.streak || 0) >= 30 ? SVG_PATHS.BIG_FIRE : SVG_PATHS.FIRE, condition: (stats.streak || 0) >= 3, val: `${stats.streak || 0}天` },
        { type: 'boat', name: '友谊之船', desc: '连续互动7天获得', icon: 'badge-boat', path: (stats.streak || 0) >= 30 ? SVG_PATHS.SHIP : SVG_PATHS.BOAT, condition: (stats.streak || 0) >= 7, val: (stats.streak || 0) >= 30 ? '已升级巨轮' : '已点亮' },
        { type: 'splash', name: '闲聊水花', desc: '累计互动消息超过100条点亮', icon: 'badge-splash', path: SVG_PATHS.SPLASH, condition: (stats.count || 0) >= 100, val: `${stats.count || 0}条` },
        { type: 'record', name: '共鸣唱片', desc: '连续一起听歌3天获得', icon: 'badge-record', path: SVG_PATHS.RECORD, condition: (stats.musicStreak || 0) >= 3, val: `${stats.musicStreak || 0}天` }
    ];

    badgeConfigs.forEach(config => {
        const isWorn = stats.wornBadge === config.type;
        const card = document.createElement('div');
        card.className = `id-badge-card ${config.condition ? '' : 'locked'} ${isWorn ? 'worn' : ''}`;
        
        // 核心修复：无论是否达成条件都允许点击，未达成时在弹窗内提示
        card.onclick = () => openBadgeActionModal(config);
        
        card.innerHTML = `
            <div class="badge-icon ${config.icon}">
                <svg viewBox="0 0 24 24"><path d="${config.path}"/></svg>
            </div>
            <div class="id-badge-info">
                <div class="id-badge-name">${config.name} ${isWorn ? '<span style="font-size:10px; background:#111; color:#fff; padding:2px 6px; border-radius:4px; margin-left:5px;">佩戴中</span>' : ''}</div>
                <div class="id-badge-desc">${config.desc} ${config.condition ? `(${config.val})` : ''}</div>
                <div class="id-badge-status">${config.condition ? '点击查看详情' : '尚未解锁'}</div>
            </div>
        `;
        listEl.appendChild(card);
    });
}

// --- 佩戴操作弹窗逻辑 ---
function openBadgeActionModal(config) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}')[currentChatRoomCharId] || { streak: 0, count: 0, littleLuck: false, wornBadge: null };
    const isWorn = stats.wornBadge === config.type;

    document.getElementById('badgeActionIcon').innerHTML = `<svg viewBox="0 0 24 24"><path d="${config.path}"/></svg>`;
    document.getElementById('badgeActionIcon').className = `badge-action-big-icon ${config.icon}`;
    document.getElementById('badgeActionTitle').innerText = config.name;
    
    // 核心修复：根据标识类型显示真实天数/条数
    let detailText = "";
    if (config.type === 'luck') {
        detailText = "成为新朋友当天互发消息获得";
    } else if (config.type === 'fire') {
        detailText = `与好友互发消息连续超过 ${stats.streak || 0} 天`;
    } else if (config.type === 'boat') {
        detailText = `与好友互发消息连续超过 ${stats.streak || 0} 天`;
    } else if (config.type === 'splash') {
        detailText = `与好友累计互发消息超过 ${stats.count || 0} 条`;
    } else if (config.type === 'record') {
        detailText = `与好友连续一起听歌超过 ${stats.musicStreak || 0} 天`;
    }
    document.getElementById('badgeActionDesc').innerText = detailText;

    const btn = document.getElementById('badgeActionBtn');
    const statusTag = document.getElementById('badgeActionStatusTag');
    
    if (config.condition) {
        btn.style.display = 'flex';
        btn.innerText = isWorn ? '取消佩戴' : '佩戴';
        btn.style.background = isWorn ? '#f4f4f4' : '#0095ff';
        btn.style.color = isWorn ? '#666' : '#fff';
        btn.onclick = () => toggleWearBadge(config.type);
        statusTag.innerText = '已获得';
        statusTag.style.background = '#f0f4ff';
        statusTag.style.color = '#0095ff';
    } else {
        btn.style.display = 'none'; 
        statusTag.innerText = '尚未获得';
        statusTag.style.background = '#f5f5f5';
        statusTag.style.color = '#aaa';
    }

    document.getElementById('badgeActionModalOverlay').classList.add('show');
}

function closeBadgeActionModal() {
    document.getElementById('badgeActionModalOverlay').classList.remove('show');
}

function toggleWearBadge(badgeType) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let allStats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
    let stats = allStats[currentChatRoomCharId];

    if (stats.wornBadge === badgeType) {
        stats.wornBadge = null; 
    } else {
        stats.wornBadge = badgeType; 
    }

    ChatDB.setItem(`interaction_stats_${currentLoginId}`, JSON.stringify(allStats));
    closeBadgeActionModal();
    renderInteractionDetail();
    
    if (currentChatRoomCharId) {
        // 【性能优化】：不要重新 openChatRoom 全量渲染，只更新标题栏的标识即可
        updateChatRoomTitleBadge(currentChatRoomCharId);
        renderChatList(); 
    }
}

// 新增辅助函数：仅更新标题栏标识
function updateChatRoomTitleBadge(charId) {
    let chars = getAllEntities();
    const char = chars.find(c => c.id === charId);
    const currentLoginId = ChatDB.getItem('current_login_account');
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    const displayName = remarks[charId] || (char ? (char.netName || char.name) : '未命名');
    const wornBadgeHtml = getWornBadgeHtml(charId);
    const titleEl = document.getElementById('chatRoomTitle');
    if (titleEl) {
        titleEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${displayName}${wornBadgeHtml}</span>`;
    }
}

// 3. 渲染会话列表
function renderChatList() {
    const listEl = document.getElementById('chatSessionList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">请先登录</div>';
        return;
    }

    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    
    // 动态注入关联账号虚拟会话
    const isLinkedEnabled = ChatDB.getItem(`linked_account_enabled_${currentLoginId}`) === 'true';
    if (isLinkedEnabled && !sessions.includes('linked_account_virtual_id')) {
        sessions.push('linked_account_virtual_id');
    } else if (!isLinkedEnabled && sessions.includes('linked_account_virtual_id')) {
        sessions = sessions.filter(id => id !== 'linked_account_virtual_id');
    }

    let allChars = getAllEntities();
    let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');

    // 获取搜索关键字
    const searchInput = document.getElementById('chatSessionSearchInput');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (sessions.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">暂无聊天记录</div>';
        return;
    }

    // 获取关联账号的清空时间戳
    const linkedClearTime = parseInt(ChatDB.getItem(`linked_account_clear_time_${currentLoginId}`) || '0');

    let sessionTimes = {};
    let linkedSessionData = { unread: 0, text: '暂无新消息', timeStr: '', timestamp: 0 };
    
    sessions.forEach(charId => {
        if (charId === 'linked_account_virtual_id') {
            let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
            linkedAccounts.forEach(accId => {
                let accSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${accId}`) || '[]');
                accSessions.forEach(targetId => {
                    let unread = parseInt(ChatDB.getItem(`unread_${accId}_${targetId}`) || '0');
                    // 【核心修复】：只有当存在未读消息时，才去抓取历史记录作为预览！
                    if (unread > 0) {
                        linkedSessionData.unread += unread;
                        
                        let history = JSON.parse(ChatDB.getItem(`chat_history_${accId}_${targetId}`) || '[]');
                        if (history.length > 0) {
                            let lastMsg = history[history.length - 1];
                            if (lastMsg.timestamp > linkedClearTime && lastMsg.timestamp > linkedSessionData.timestamp) {
                                linkedSessionData.timestamp = lastMsg.timestamp;
                                let safeContent = lastMsg.content || '';
                                let contentText = safeContent.replace(/<[^>]+>/g, '');
                                if (lastMsg.type === 'image' || safeContent.includes('<img')) contentText = '[图片]';
                                else if (lastMsg.type === 'voice') contentText = '[语音]';
                                else if (lastMsg.type === 'forward_record') contentText = '[聊天记录]';
                                
                                const targetEntity = allChars.find(e => e.id === targetId);
                                const targetName = targetEntity ? (targetEntity.netName || targetEntity.name) : '未知';
                                linkedSessionData.text = `${targetName}: ${contentText}`;
                                
                                const date = new Date(lastMsg.timestamp);
                                const now = new Date();
                                linkedSessionData.timeStr = date.toDateString() === now.toDateString() 
                                    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                                    : `${date.getMonth() + 1}/${date.getDate()}`;
                            }
                        }
                    }
                });
            });
            sessionTimes[charId] = linkedSessionData.timestamp;
        } else {
            let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
            sessionTimes[charId] = history.length > 0 ? history[history.length - 1].timestamp : 0;
        }
    });

    // 排序逻辑：置顶优先，然后按最后消息时间倒序
    sessions.sort((a, b) => {
        const statA = stats[a] || {};
        const statB = stats[b] || {};
        if (statA.pinned !== statB.pinned) return statA.pinned ? -1 : 1;
        return sessionTimes[b] - sessionTimes[a];
    });

    let renderCount = 0;

    sessions.forEach(charId => {
        if (charId === 'linked_account_virtual_id') {
            if (keyword && !'我的关联账号'.includes(keyword)) return;
            renderCount++;
            
            const charStat = stats[charId] || {};
            const unreadBadgeHtml = linkedSessionData.unread > 0 ? `<div class="wechat-unread-badge">${linkedSessionData.unread > 99 ? '99+' : linkedSessionData.unread}</div>` : '';
            
            const item = document.createElement('div');
            item.className = `wechat-list-item ${charStat.pinned ? 'is-pinned' : ''}`;
            
            item.ontouchstart = (e) => handleSessionPressStart(e, charId);
            item.ontouchend = handleSessionPressEnd;
            item.onmousedown = (e) => handleSessionPressStart(e, charId);
            item.onmouseup = handleSessionPressEnd;
            item.onclick = () => openLinkedAccountManager();

            item.innerHTML = `
                <div style="position: relative;">
                    <div class="wechat-avatar linked-session-avatar" style="background: #007AFF; display: flex; justify-content: center; align-items: center;">
                        <svg viewBox="0 0 24 24" width="26" height="26" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    ${unreadBadgeHtml}
                </div>
                <div class="wechat-info">
                    <div class="wechat-name-row">
                        ${charStat.pinned ? '<span class="top-tag">Top</span>' : ''}
                        <span class="wechat-name">我的关联账号</span>
                    </div>
                    <div class="wechat-msg" style="color: ${linkedSessionData.unread > 0 ? '#333' : '#888'}">${linkedSessionData.text}</div>
                </div>
                <div class="wechat-right-col">
                    <div class="wechat-time">${linkedSessionData.timeStr}</div>
                </div>
            `;
            listEl.appendChild(item);
            return;
        }

        const char = allChars.find(c => c.id === charId);
        if (!char) return;

        const charStat = stats[charId] || {};
        const displayName = remarks[charId] || char.netName || char.name;
        
        if (keyword && !displayName.toLowerCase().includes(keyword)) return;
        
        renderCount++;
        const wornBadgeHtml = getWornBadgeHtml(charId);

        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
        let lastMsgText = '点击进入聊天...';
        let lastMsgTime = '';
        
        if (history.length > 0) {
            const lastMsg = history[history.length - 1];
            const safeContent = lastMsg.content || '';
            if (lastMsg.type === 'image') lastMsgText = '[图片]';
            else if (lastMsg.type === 'voice') lastMsgText = '[语音]';
            else if (lastMsg.type === 'forward_record') lastMsgText = '[聊天记录]';
            else if (safeContent.includes('<img')) lastMsgText = '[表情包]';
            else lastMsgText = safeContent.replace(/<[^>]+>/g, '');
            
            const date = new Date(lastMsg.timestamp);
            const now = new Date();
            lastMsgTime = date.toDateString() === now.toDateString() 
                ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                : `${date.getMonth() + 1}/${date.getDate()}`;
        }

        const unreadCount = parseInt(ChatDB.getItem(`unread_${currentLoginId}_${charId}`) || '0');
        const unreadBadgeHtml = unreadCount > 0 ? `<div class="wechat-unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : '';

        const item = document.createElement('div');
        item.className = `wechat-list-item ${charStat.pinned ? 'is-pinned' : ''}`;
        
        item.ontouchstart = (e) => handleSessionPressStart(e, charId);
        item.ontouchend = handleSessionPressEnd;
        item.onmousedown = (e) => handleSessionPressStart(e, charId);
        item.onmouseup = handleSessionPressEnd;
        item.onclick = () => openChatRoom(charId);

        // 动态渲染头像：如果有图片则显示图片，否则根据是否为群聊显示默认渐变头像
        let avatarHtml = '';
        if (char.avatarUrl) {
            avatarHtml = `<div class="wechat-avatar" style="background-image: url('${char.avatarUrl}')"></div>`;
        } else {
            const initial = displayName.charAt(0).toUpperCase();
            const avatarClass = char.isGroup ? 'group' : 'friend';
            avatarHtml = `<div class="ios-msg-avatar ${avatarClass}" style="width: 38px; height: 38px; font-size: 16px; margin-right: 10px;">${initial}</div>`;
        }

        item.innerHTML = `
            <div style="position: relative;">
                ${avatarHtml}
                ${unreadBadgeHtml}
            </div>
            <div class="wechat-info">
                <div class="wechat-name-row">
                    ${charStat.pinned ? '<span class="top-tag">Top</span>' : ''}
                    <span class="wechat-name">${displayName}</span>
                    ${charStat.special ? '<svg class="special-concern-star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' : ''}
                    ${wornBadgeHtml}
                </div>
                <div class="wechat-msg">${lastMsgText}</div>
            </div>
            <div class="wechat-right-col">
                <div class="wechat-time">${lastMsgTime}</div>
            </div>
        `;
        listEl.appendChild(item);
    });

    if (renderCount === 0 && keyword) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">未找到匹配的会话</div>';
    }
}

function renderLinkedAccounts() {
    const topListEl = document.getElementById('linkedAccTopList');
    const msgListEl = document.getElementById('linkedAccMsgList');
    const otherListEl = document.getElementById('linkedAccOtherList');
    
    topListEl.innerHTML = '';
    msgListEl.innerHTML = '';
    otherListEl.innerHTML = '';

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
    let allEntities = getAllEntities();
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    
    // 获取清空时间戳
    const linkedClearTime = parseInt(ChatDB.getItem(`linked_account_clear_time_${currentLoginId}`) || '0');

    if (linkedAccounts.length === 0) {
        topListEl.innerHTML = '<div style="font-size: 13px; color: #aaa; padding: 10px 0;">暂无关联账号</div>';
        msgListEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; padding: 40px 0;">暂无消息</div>';
    } else {
        let allMsgItems = []; 

        linkedAccounts.forEach(accId => {
            const accEntity = allEntities.find(e => e.id === accId);
            if (!accEntity) return;
            const accName = accEntity.netName || accEntity.name;

            let totalUnreadCount = 0;

            let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${accId}`) || '[]');
            sessions.forEach(targetId => {
                let unread = parseInt(ChatDB.getItem(`unread_${accId}_${targetId}`) || '0');
                if (unread > 0) {
                    totalUnreadCount += unread;
                    
                    let history = JSON.parse(ChatDB.getItem(`chat_history_${accId}_${targetId}`) || '[]');
                    if (history.length > 0) {
                        let lastMsg = history[history.length - 1];
                        // 【核心修复】：只有晚于清空时间的消息，才显示在面板列表中
                        if (lastMsg.timestamp > linkedClearTime) {
                            let contentText = lastMsg.content.replace(/<[^>]+>/g, '');
                            if (lastMsg.type === 'image' || lastMsg.content.includes('<img')) contentText = '[图片]';
                            else if (lastMsg.type === 'voice') contentText = '[语音]';
                            
                            const targetEntity = allEntities.find(e => e.id === targetId);
                            
                            allMsgItems.push({
                                accId: accId,
                                accName: accName,
                                targetId: targetId,
                                targetEntity: targetEntity,
                                unread: unread,
                                text: contentText,
                                timestamp: lastMsg.timestamp
                            });
                        }
                    }
                }
            });

            const isSelected = currentSelectedLinkedAccId === accId;
            const isDimmed = currentSelectedLinkedAccId !== 'all' && !isSelected;

            const avatarItem = document.createElement('div');
            avatarItem.className = `linked-avatar-item ${isLinkedAccManaging ? 'is-deleting' : ''}`;
            avatarItem.style.opacity = isDimmed ? '0.4' : '1';
            avatarItem.style.transition = 'opacity 0.2s';
            
            const unreadBadge = totalUnreadCount > 0 ? `<div class="wechat-unread-badge" style="top: -4px; right: -4px;">${totalUnreadCount > 99 ? '99+' : totalUnreadCount}</div>` : '';
            const deleteBtn = isLinkedAccManaging ? `<div class="linked-delete-btn" onclick="event.stopPropagation(); removeLinkedAccount('${accId}')">×</div>` : '';
            const borderStyle = isSelected ? 'border: 2px solid #007AFF;' : 'border: 2px solid #fff;';

            avatarItem.innerHTML = `
                <div class="linked-avatar-img" style="background-image: url('${accEntity.avatarUrl || ''}'); ${borderStyle}">
                    ${deleteBtn}
                    ${!isLinkedAccManaging ? `
                    <div class="linked-avatar-badge">
                        <svg viewBox="0 0 24 24"><path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 9.16 8.16a5.38 5.38 0 0 0-3.77-1.54C2.42 6.62 0 9.04 0 12s2.42 5.38 5.39 5.38c1.44 0 2.8-.56 3.77-1.53L12 13.34l2.84 2.5c.97.97 2.33 1.53 3.77 1.53 2.97 0 5.39-2.42 5.39-5.38s-2.42-5.38-5.39-5.38zm0 8.76c-.9 0-1.75-.35-2.36-.99l-4.24-3.73 4.24-3.73c.61-.64 1.46-.99 2.36-.99 1.87 0 3.39 1.52 3.39 3.38s-1.52 3.38-3.39 3.38zM5.39 15.38c-.9 0-1.75-.35-2.36-.99C2.42 13.75 2 12.9 2 12s.42-1.75 1.03-2.39c.61-.64 1.46-.99 2.36-.99 1.87 0 3.39 1.52 3.39 3.38s-1.52 3.38-3.39 3.38z"/></svg>
                    </div>
                    ` : ''}
                    ${unreadBadge}
                </div>
                <div class="linked-avatar-name" style="color: ${isSelected ? '#007AFF' : '#333'};">${accName}</div>
            `;
            
            avatarItem.onclick = () => {
                if (!isLinkedAccManaging) {
                    currentSelectedLinkedAccId = (currentSelectedLinkedAccId === accId) ? 'all' : accId;
                    renderLinkedAccounts();
                }
            };
            topListEl.appendChild(avatarItem);
        });

        allMsgItems.sort((a, b) => b.timestamp - a.timestamp);
        
        if (currentSelectedLinkedAccId !== 'all') {
            allMsgItems = allMsgItems.filter(item => item.accId === currentSelectedLinkedAccId);
        }

        if (allMsgItems.length === 0) {
            msgListEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; padding: 40px 0;">暂无新消息</div>';
        } else {
            allMsgItems.forEach(item => {
                const targetName = item.targetEntity ? (remarks[item.targetId] || item.targetEntity.netName || item.targetEntity.name) : '未知';
                const targetAvatar = item.targetEntity ? item.targetEntity.avatarUrl : '';
                
                const date = new Date(item.timestamp);
                const now = new Date();
                const timeStr = date.toDateString() === now.toDateString() 
                    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                    : `${date.getMonth() + 1}/${date.getDate()}`;

                const msgItem = document.createElement('div');
                msgItem.className = 'linked-msg-item';
                
                // 核心修改：点击消息直接切换账号并打开聊天室
                msgItem.onclick = () => {
                    // 1. 切换当前登录账号为该关联账号
                    ChatDB.setItem('current_login_account', item.accId);
                    
                    // 2. 关闭关联账号管理面板
                    closeLinkedAccountManager();
                    
                    // 3. 全局刷新微信主界面数据
                    renderMePage();
                    if (typeof renderChatList === 'function') renderChatList();
                    if (typeof renderContactList === 'function') renderContactList();
                    if (typeof renderMoments === 'function') renderMoments();
                    
                    // 4. 切换到底部的“Chat(聊天列表)” Tab
                    switchWechatTab('chat');
                    
                    // 5. 直接打开对应的聊天室
                    openChatRoom(item.targetId);
                    
                    // 6. 提示切换成功
                    showToast(`已切换至 ${item.accName}`, 'success', 1500);
                };
                
                const msgUnreadBadge = `<div class="wechat-unread-badge" style="position: relative; top: 0; right: 0;">${item.unread > 99 ? '99+' : item.unread}</div>`;

                msgItem.innerHTML = `
                    <div class="linked-msg-avatar" style="background-image: url('${targetAvatar}');"></div>
                    <div class="linked-msg-info">
                        <div class="linked-msg-name">${targetName}</div>
                        <div class="linked-msg-preview">${item.accName}: ${item.text}</div>
                    </div>
                    <div class="linked-msg-right">
                        <div class="linked-msg-time">${timeStr}</div>
                        ${msgUnreadBadge}
                    </div>
                `;
                msgListEl.appendChild(msgItem);
            });
        }
    }

    const availableEntities = allEntities.filter(e => e.id !== currentLoginId && !linkedAccounts.includes(e.id));
    
    // 核心修改：如果已经关联了 3 个，直接提示已达上限，不再渲染可添加的列表
    if (linkedAccounts.length >= 3) {
        otherListEl.innerHTML = '<div style="font-size: 12px; color: #ccc; padding: 10px 0;">关联账号数量已达上限 (3个)</div>';
    } else if (availableEntities.length === 0) {
        otherListEl.innerHTML = '<div style="font-size: 12px; color: #ccc; padding: 10px 0;">没有可关联的其他账号</div>';
    } else {
        availableEntities.forEach(entity => {
            const otherItem = document.createElement('div');
            otherItem.className = 'linked-avatar-item';
            otherItem.onclick = () => addLinkedAccount(entity.id);
            otherItem.innerHTML = `
                <div class="linked-avatar-img" style="background-image: url('${entity.avatarUrl || ''}'); opacity: 0.6;">
                    <div style="position: absolute; bottom: -2px; right: -2px; width: 18px; height: 18px; background: #ccc; border-radius: 50%; border: 2px solid #fff; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 14px; font-weight: bold;">+</div>
                </div>
                <div class="linked-avatar-name" style="color: #888;">${entity.netName || entity.name}</div>
            `;
            otherListEl.appendChild(otherItem);
        });
    }
}

function clearLinkedUnread() {
    if (confirm('确定要清空所有关联账号的未读消息提醒吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        if (!currentLoginId) return;
        let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
        
        linkedAccounts.forEach(accId => {
            let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${accId}`) || '[]');
            sessions.forEach(targetId => {
                ChatDB.setItem(`unread_${accId}_${targetId}`, '0');
            });
        });
        
        // 【核心修复】：记录清空时间戳，用于过滤旧消息
        ChatDB.setItem(`linked_account_clear_time_${currentLoginId}`, Date.now().toString());
        
        renderLinkedAccounts();
        if (typeof renderChatList === 'function') renderChatList();
        showToast('未读消息已清空', 'success', 1500);
    }
}

// 4. 长按菜单逻辑
function handleSessionPressStart(e, charId) {
    sessionPressTimer = setTimeout(() => {
        currentActionSessionId = charId;
        showSessionMenu();
    }, 600);
}

function handleSessionPressEnd() {
    clearTimeout(sessionPressTimer);
}

function showSessionMenu() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}')[currentActionSessionId] || {};
    
    document.getElementById('menuPinBtn').querySelector('span').innerText = stats.pinned ? '取消置顶' : '置顶会话';
    document.getElementById('menuSpecialBtn').querySelector('span').innerText = stats.special ? '取消特别关心' : '特别关心';
    
    document.getElementById('sessionMenuOverlay').classList.add('show');
}

function closeSessionMenu() {
    document.getElementById('sessionMenuOverlay').classList.remove('show');
}

function actionTogglePin() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
    if (!stats[currentActionSessionId]) stats[currentActionSessionId] = {};
    stats[currentActionSessionId].pinned = !stats[currentActionSessionId].pinned;
    ChatDB.setItem(`interaction_stats_${currentLoginId}`, JSON.stringify(stats));
    renderChatList();
    closeSessionMenu();
}

function actionToggleSpecial() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
    if (!stats[currentActionSessionId]) stats[currentActionSessionId] = {};
    stats[currentActionSessionId].special = !stats[currentActionSessionId].special;
    ChatDB.setItem(`interaction_stats_${currentLoginId}`, JSON.stringify(stats));
    renderChatList();
    closeSessionMenu();
}

function actionDeleteSession() {
    if (currentActionSessionId === 'linked_account_virtual_id') {
        alert('关联账号会话无法直接删除，请前往设置关闭开关。');
        closeSessionMenu();
        return;
    }
    if (confirm('确定删除该会话吗？聊天记录将保留。')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
        sessions = sessions.filter(id => id !== currentActionSessionId);
        ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));
        renderChatList();
        closeSessionMenu();
    }
}

function actionMarkRead() {
    closeSessionMenu();
}

// --- 通讯录子 Tab 切换逻辑 ---
function switchContactSubTab(tabName) {
    const btns = document.querySelectorAll('.contact-nav-btn');
    const wrapper = document.getElementById('contactSliderWrapper');
    
    btns.forEach(btn => btn.classList.remove('active'));
    
    if (tabName === 'categories') {
        btns[0].classList.add('active');
        wrapper.style.transform = 'translateX(0%)';
        renderContactCategories(); // 渲染分组
    } else if (tabName === 'special') {
        btns[1].classList.add('active');
        wrapper.style.transform = 'translateX(-33.333%)';
        renderContactSpecial(); // 渲染特别关心
    } else if (tabName === 'groups') {
        btns[2].classList.add('active');
        wrapper.style.transform = 'translateX(-66.666%)';
        renderContactGroups(); // 新增：渲染群聊
    }
}

// 1. 渲染通讯录中的 Categories (分组列表)
function renderContactCategories() {
    const listEl = document.getElementById('contactCategoriesList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let userGroups = JSON.parse(ChatDB.getItem(`contact_groups_${currentLoginId}`) || '["默认分组"]');
    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    let allEntities = getAllEntities(); // 使用合并后的实体
    
    const currentUser = allEntities.find(e => e.id === currentLoginId);
    const isChar = currentUser && !currentUser.isAccount;

    // 【核心修复】：双向通讯录的动态补全与同分组 Char 自动添加
    let dynamicContacts = new Set(contacts);

    if (isChar) {
        // 1. 补全 User：遍历所有 User，如果 User 的通讯录里有当前 Char，则把 User 加进来
        let allUsers = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        allUsers.forEach(u => {
            let uContacts = JSON.parse(ChatDB.getItem(`contacts_${u.id}`) || '[]');
            if (uContacts.includes(currentLoginId)) {
                dynamicContacts.add(u.id);
            }
        });

        // 2. 补全同分组 Char：找到和当前 Char 同 group 且生成了账号密码的 Char
        let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        let myGroup = currentUser.group || '默认分组';
        allChars.forEach(c => {
            if (c.id !== currentLoginId && c.group === myGroup && c.account && c.password) {
                dynamicContacts.add(c.id);
            }
        });
    } else {
        // 如果是 User 登录，也做一次反向检查，防止遗漏
        let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        allChars.forEach(c => {
            let cContacts = JSON.parse(ChatDB.getItem(`contacts_${c.id}`) || '[]');
            if (cContacts.includes(currentLoginId)) {
                dynamicContacts.add(c.id);
            }
        });
    }

    // 将 Set 转回数组
    let finalContacts = Array.from(dynamicContacts);

    userGroups.forEach(groupName => {
        const groupFriends = finalContacts.map(id => allEntities.find(c => c.id === id)).filter(c => c && (c.contactGroup || '默认分组') === groupName);

        const groupItem = document.createElement('div');
        groupItem.className = 'contact-group-item';
        groupItem.style.background = '#fff';
        groupItem.style.borderRadius = '16px';
        groupItem.style.overflow = 'hidden';
        groupItem.style.marginBottom = '10px';

        let pressTimer;
        let touchEvent;
        const startPress = (e) => {
            touchEvent = e;
            pressTimer = setTimeout(() => {
                handleGroupLongPress(groupName, currentLoginId, touchEvent);
            }, 600);
        };
        const cancelPress = () => clearTimeout(pressTimer);

        groupItem.innerHTML = `
            <div class="contact-group-header" style="padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <div class="contact-group-title" style="font-weight: bold; color: #333; font-size: 15px;">
                    ${groupName}
                </div>
                <div class="contact-group-count" style="color: #aaa; font-size: 12px;">${groupFriends.length}</div>
            </div>
            <div class="contact-group-content" style="display: none; padding: 0 15px 15px 15px; flex-direction: column; gap: 10px;">
                ${groupFriends.length === 0 ? '<div style="text-align:center; color:#ccc; font-size:12px;">暂无好友</div>' : ''}
            </div>
        `;

        const header = groupItem.querySelector('.contact-group-header');
        const content = groupItem.querySelector('.contact-group-content');

        header.addEventListener('touchstart', startPress, { passive: true });
        header.addEventListener('touchend', cancelPress, { passive: true });
        header.addEventListener('touchmove', cancelPress, { passive: true });
        header.addEventListener('mousedown', startPress);
        header.addEventListener('mouseup', cancelPress);
        header.addEventListener('mouseleave', cancelPress);

        header.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'flex' : 'none';
        });

        groupFriends.forEach(friend => {
            const friendEl = document.createElement('div');
            friendEl.style.display = 'flex';
            friendEl.style.alignItems = 'center';
            friendEl.style.gap = '10px';
            friendEl.style.cursor = 'pointer';
            friendEl.onclick = () => openCharProfilePanel(friend.id);
            const typeTag = friend.isAccount ? '<span style="font-size:10px; background:#eee; color:#888; padding:2px 4px; border-radius:4px; margin-left:4px;">用户</span>' : '';
            friendEl.innerHTML = `
                <div style="width: 40px; height: 40px; border-radius: 10px; background-image: url('${friend.avatarUrl || ''}'); background-size: cover; background-color: #eee;"></div>
                <div style="flex: 1; font-size: 14px; font-weight: bold; color: #333;">${friend.netName || friend.name}${typeTag}</div>
            `;
            content.appendChild(friendEl);
        });

        listEl.appendChild(groupItem);
    });
}

// 2. 渲染通讯录中的 Special (特别关心)
function renderContactSpecial() {
    const listEl = document.getElementById('contactSpecialList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    let allEntities = getAllEntities();
    let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
    
    // 获取所有已添加的好友，并且 special 为 true
    const specialFriends = contacts.map(id => allEntities.find(c => c.id === id)).filter(c => c && stats[c.id] && stats[c.id].special);

    if (specialFriends.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#ccc; font-size:13px; margin-top: 40px;">暂无特别关心的好友</div>';
        return;
    }

    specialFriends.forEach(friend => {
        const friendEl = document.createElement('div');
        friendEl.style.display = 'flex';
        friendEl.style.alignItems = 'center';
        friendEl.style.gap = '15px';
        friendEl.style.padding = '15px';
        friendEl.style.background = '#fff';
        friendEl.style.borderRadius = '16px';
        friendEl.style.marginBottom = '10px';
        friendEl.style.cursor = 'pointer';
        friendEl.onclick = () => openCharProfilePanel(friend.id);
        const typeTag = friend.isAccount ? '<span style="font-size:10px; background:#eee; color:#888; padding:2px 4px; border-radius:4px; margin-left:4px;">用户</span>' : '';
        friendEl.innerHTML = `
            <div style="width: 48px; height: 48px; border-radius: 12px; background-image: url('${friend.avatarUrl || ''}'); background-size: cover; background-color: #eee;"></div>
            <div style="flex: 1; font-size: 16px; font-weight: bold; color: #333;">${friend.netName || friend.name}${typeTag}</div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#111"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        `;
        listEl.appendChild(friendEl);
    });
}

// 3. 新增：渲染通讯录中的 Groups (群聊)
function renderContactGroups() {
    const listEl = document.getElementById('contactGroupsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    let allEntities = getAllEntities();
    
    // 筛选出通讯录中 isGroup 为 true 的实体
    const groupFriends = contacts.map(id => allEntities.find(c => c.id === id)).filter(c => c && c.isGroup);

    if (groupFriends.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#ccc; font-size:13px; margin-top: 40px;">暂无群聊</div>';
        return;
    }

    groupFriends.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.style.display = 'flex';
        groupEl.style.alignItems = 'center';
        groupEl.style.gap = '15px';
        groupEl.style.padding = '15px';
        groupEl.style.background = '#fff';
        groupEl.style.borderRadius = '16px';
        groupEl.style.marginBottom = '10px';
        groupEl.style.cursor = 'pointer';
        
        // 点击群聊直接打开聊天室
        groupEl.onclick = () => {
            switchWechatTab('chat');
            openChatRoom(group.id);
        };
        
        // 群聊默认头像 (蓝色渐变)
        let avatarHtml = '';
        if (group.avatarUrl) {
            avatarHtml = `<div style="width: 48px; height: 48px; border-radius: 12px; background-image: url('${group.avatarUrl}'); background-size: cover; background-position: center;"></div>`;
        } else {
            const initial = (group.netName || group.name || '群').charAt(0).toUpperCase();
            avatarHtml = `<div class="ios-msg-avatar group" style="width: 48px; height: 48px; font-size: 20px; border-radius: 12px;">${initial}</div>`;
        }

        groupEl.innerHTML = `
            ${avatarHtml}
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <div style="font-size: 16px; font-weight: bold; color: #333;">${group.netName || group.name}</div>
                <div style="font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${group.signature || '群聊'}</div>
            </div>
        `;
        listEl.appendChild(groupEl);
    });
}

// 处理分组长按逻辑 (弹出自定义菜单)
function handleGroupLongPress(groupName, currentLoginId, e) {
    // 获取点击坐标
    let clientX = 0;
    let clientY = 0;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const overlay = document.getElementById('contextMenuOverlay');
    const menu = document.getElementById('contextMenu');
    
    // 构建菜单内容 (带 SVG 图标)
    let menuHtml = `
        <div class="context-menu-item" onclick="actionRenameGroup('${groupName}', '${currentLoginId}')">
            <div class="context-menu-icon">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            修改名称
        </div>
        <div class="context-menu-item" onclick="actionCreateGroup('${currentLoginId}')">
            <div class="context-menu-icon">
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
            新建分组
        </div>
    `;

    // 默认分组不显示删除按钮
    if (groupName !== '默认分组') {
        menuHtml += `
            <div class="context-menu-item danger" onclick="actionDeleteGroup('${groupName}', '${currentLoginId}')">
                <div class="context-menu-icon">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </div>
                删除分组
            </div>
        `;
    }

    menu.innerHTML = menuHtml;

    // 显示遮罩层以便获取菜单实际宽高
    overlay.classList.add('show');
    
    // 动态计算位置，防止菜单超出屏幕边缘
    const menuRect = menu.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    let left = clientX;
    let top = clientY;

    // 如果右侧空间不够，向左偏移
    if (left + menuRect.width > screenWidth - 20) {
        left = screenWidth - menuRect.width - 20;
    }
    // 如果下方空间不够，向上偏移
    if (top + menuRect.height > screenHeight - 20) {
        top = screenHeight - menuRect.height - 20;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function closeContextMenu() {
    document.getElementById('contextMenuOverlay').classList.remove('show');
}

// 菜单具体操作函数：修改名称
function actionRenameGroup(groupName, currentLoginId) {
    closeContextMenu();
    if (groupName === '默认分组') return alert('默认分组不可修改名称！');
    openGlobalPrompt('修改名称', '请输入新的分组名称', '⸝⸝⸝ ╸▵╺⸝⸝⸝', (newName) => {
        if (newName && newName.trim() !== '' && newName !== groupName) {
            let userGroups = JSON.parse(ChatDB.getItem(`contact_groups_${currentLoginId}`) || '["默认分组"]');
            if (userGroups.includes(newName)) return alert('分组名已存在！');
            const index = userGroups.indexOf(groupName);
            if (index !== -1) {
                userGroups[index] = newName.trim();
                ChatDB.setItem(`contact_groups_${currentLoginId}`, JSON.stringify(userGroups));
                
                // 同步修改该分组下好友的 contactGroup 字段
                let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
                let modified = false;
                allChars.forEach(c => {
                    if (c.contactGroup === groupName) {
                        c.contactGroup = newName.trim();
                        modified = true;
                    }
                });
                if (modified) ChatDB.setItem('chat_chars', JSON.stringify(allChars));
                
                renderContactFriends();
            }
        }
    }, groupName);
}

// 菜单具体操作函数：新建分组
function actionCreateGroup(currentLoginId) {
    closeContextMenu();
    openGlobalPrompt('新建分组', '请输入新建分组名称', '⸝⸝⸝ ╸▵╺⸝⸝⸝', (newName) => {
        if (newName && newName.trim() !== '') {
            let userGroups = JSON.parse(ChatDB.getItem(`contact_groups_${currentLoginId}`) || '["默认分组"]');
            if (userGroups.includes(newName.trim())) return alert('分组名已存在！');
            userGroups.push(newName.trim());
            ChatDB.setItem(`contact_groups_${currentLoginId}`, JSON.stringify(userGroups));
            renderContactFriends();
        }
    });
}

// 菜单具体操作函数：删除分组
function actionDeleteGroup(groupName, currentLoginId) {
    closeContextMenu();
    if (confirm(`确定要删除分组 [${groupName}] 吗？该分组下的好友将被移至默认分组。`)) {
        let userGroups = JSON.parse(ChatDB.getItem(`contact_groups_${currentLoginId}`) || '["默认分组"]');
        userGroups = userGroups.filter(g => g !== groupName);
        ChatDB.setItem(`contact_groups_${currentLoginId}`, JSON.stringify(userGroups));
        
        // 将该分组下的好友移入默认分组
        let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        let modified = false;
        allChars.forEach(c => {
            if (c.contactGroup === groupName) {
                c.contactGroup = '默认分组';
                modified = true;
            }
        });
        if (modified) ChatDB.setItem('chat_chars', JSON.stringify(allChars));
        
        renderContactFriends();
    }
}


// 覆盖原有的 renderContactList，使其初始化时渲染 Categories (分组)
function renderContactList() {
    switchContactSubTab('categories'); // 默认打开 Categories
}

// ==========================================
// 角色库分组与 Create 弹窗逻辑
// ==========================================

// 1. 分组弹窗逻辑
const charGroupPopup = document.getElementById('charGroupPopup');
let isCharGroupEditing = false;

function toggleCharGroupPopup() {
    charGroupPopup.classList.toggle('show');
    document.getElementById('charCreatePopup').classList.remove('show'); // 互斥隐藏
}

function toggleCharGroupEditMode() {
    isCharGroupEditing = !isCharGroupEditing;
    const editBtn = document.getElementById('charGroupEditBtn');
    if (isCharGroupEditing) {
        charGroupPopup.classList.add('is-editing');
        editBtn.innerText = 'Done';
    } else {
        charGroupPopup.classList.remove('is-editing');
        editBtn.innerText = 'Edit';
    }
}

// ==========================================
// 角色库分组完整逻辑 (持久化 + 渲染)
// ==========================================
let charGroups = JSON.parse(ChatDB.getItem('chat_char_groups') || '["默认分组"]');
let currentCharGroupFilter = '默认分组';

function saveCharGroups() {
    ChatDB.setItem('chat_char_groups', JSON.stringify(charGroups));
}

function renderCharGroups() {
    // 1. 渲染角色库主页的分组列表
    const listEl = document.getElementById('charGroupList');
    if (listEl) {
        listEl.innerHTML = '';
        charGroups.forEach(g => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `
                <span class="preset-item-name">${g}</span>
                <div class="preset-delete-btn" onclick="deleteCharGroup('${g}', event)">-</div>
            `;
            item.onclick = () => {
                if (!isCharGroupEditing) {
                    currentCharGroupFilter = g;
                    document.querySelector('#charLibraryPanel .header-title').innerText = g;
                    document.getElementById('charGroupPopup').classList.remove('show');
                    renderCharLibrary(); // 重新渲染列表
                }
            };
            listEl.appendChild(item);
        });
    }

    // 2. 渲染编辑页顶部的分组选择列表
    const editListEl = document.getElementById('charEditGroupList');
    if (editListEl) {
        editListEl.innerHTML = '';
        charGroups.forEach(g => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `<span class="preset-item-name">${g}</span>`;
            item.onclick = () => {
                document.getElementById('char-edit-header-group').innerText = g;
                document.getElementById('charEditGroupPopup').classList.remove('show');
            };
            editListEl.appendChild(item);
        });
    }
}

function promptAddCharGroup() {
    openGlobalPrompt('新建分组', '请输入新分组名称', '⸝⸝⸝ ╸▵╺⸝⸝⸝', (name) => {
        if (name && name.trim() !== "") {
            if (charGroups.includes(name.trim())) return alert('分组已存在！');
            charGroups.push(name.trim());
            saveCharGroups();
            renderCharGroups();
        }
    });
}

function deleteCharGroup(groupName, e) {
    e.stopPropagation();
    if (groupName === '默认分组') return alert('默认分组不可删除！');
    if (confirm(`确定删除分组 [${groupName}] 吗？该分组下的角色将被移至默认分组。`)) {
        charGroups = charGroups.filter(g => g !== groupName);
        saveCharGroups();
        
        // 将该分组下的角色移入默认分组
        let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        chars.forEach(c => { if (c.group === groupName) c.group = '默认分组'; });
        ChatDB.setItem('chat_chars', JSON.stringify(chars));
        
        if (currentCharGroupFilter === groupName) {
            currentCharGroupFilter = '默认分组';
            document.querySelector('#charLibraryPanel .header-title').innerText = '默认分组';
        }
        renderCharGroups();
        renderCharLibrary();
    }
}

// 编辑页顶部分组弹窗开关
function toggleCharEditGroupPopup() {
    document.getElementById('charEditGroupPopup').classList.toggle('show');
}

// 点击空白处关闭编辑页分组弹窗
document.addEventListener('click', (e) => {
    const editPopup = document.getElementById('charEditGroupPopup');
    const editTitle = document.querySelector('#charEditPanel .header-title');
    if (editPopup && editPopup.classList.contains('show') && !editPopup.contains(e.target) && !editTitle.contains(e.target)) {
        editPopup.classList.remove('show');
    }
});

// 页面加载时初始化分组 (等待数据库就绪)
window.addEventListener('ChatDBReady', () => {
    charGroups = JSON.parse(ChatDB.getItem('chat_char_groups') || '["默认分组"]');
    renderCharGroups();
});

// 2. Create 弹窗逻辑
const charCreatePopup = document.getElementById('charCreatePopup');

function toggleCharCreatePopup() {
    charCreatePopup.classList.toggle('show');
    document.getElementById('charGroupPopup').classList.remove('show'); // 互斥隐藏
}

// 3. 终极角色卡导入逻辑 (深度解析酒馆 V2 协议)
function importCharCard() {
    document.getElementById('charImportInput').click();
}

async function handleCharImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    let charData = null;

    try {
        if (fileName.endsWith('.json')) {
            const text = await file.text();
            charData = parseTavernData(JSON.parse(text));
        } else if (fileName.endsWith('.png')) {
            charData = await parseTavernPng(file);
        } else if (fileName.endsWith('.txt')) {
            const text = await file.text();
            charData = { char: { name: file.name.replace('.txt',''), description: text }, worldbook: [] };
        }

        if (charData && charData.char) {
            saveImportedChar(charData, file);
        } else {
            alert('无法解析该文件，请确保是标准的酒馆角色卡！');
        }
    } catch (e) {
        console.error("解析失败:", e);
        alert('导入出错: ' + e.message);
    }
    event.target.value = ''; 
}

// 核心：解析酒馆 V1/V2 数据结构
function parseTavernData(json) {
    const data = json.data || json; // 兼容 V2 的 data 包裹层
    
    // 1. 提取角色基础信息
    const charInfo = {
        name: data.name || '未命名',
        description: data.description || data.persona || '',
        firstMessage: data.first_mes || data.mes_example || '',
        scenario: data.scenario || '',
        sex: data.creator_notes || '未知'
    };

    // 2. 提取嵌套的世界书 (Lorebook)
    let worldbookEntries = [];
    const book = data.character_book || json.character_book;
    if (book && book.entries && Array.isArray(book.entries)) {
        worldbookEntries = book.entries.map(e => ({
            id: 'wb_' + Date.now() + Math.random().toString(36).substr(2, 5),
            title: e.comment || e.keys?.[0] || '未命名词条',
            keywords: Array.isArray(e.keys) ? e.keys.join(', ') : (e.key || ''),
            content: e.content || '',
            constant: e.constant || false,
            exact: e.selective || true,
            position: e.insertion_order === 0 ? 'top' : (e.insertion_order === 1 ? 'before' : 'after')
        }));
    }

    return { char: charInfo, worldbook: worldbookEntries };
}

// 核心：读取 PNG 隐写数据
async function parseTavernPng(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const view = new DataView(buffer);
                let offset = 8; 

                while (offset < view.byteLength) {
                    const length = view.getUint32(offset);
                    const type = String.fromCharCode(
                        view.getUint8(offset + 4), view.getUint8(offset + 5),
                        view.getUint8(offset + 6), view.getUint8(offset + 7)
                    );

                    if (type === 'tEXt' || type === 'iTXt') {
                        const dataChunk = new Uint8Array(buffer, offset + 8, length);
                        const text = new TextDecoder().decode(dataChunk);
                        
                        if (text.startsWith('chara')) {
                            const base64Data = text.substring(text.indexOf('\0') + 1);
                            const decoded = decodeURIComponent(escape(atob(base64Data))); // 处理 UTF-8
                            resolve(parseTavernData(JSON.parse(decoded)));
                            return;
                        }
                    }
                    offset += length + 12;
                }
                resolve(null);
            } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
    });
}

// 保存逻辑：同步迁移世界书并绑定
function saveImportedChar(data, file) {
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    // 修复：确保默认分组存在，防止覆盖导致报错
    let localWbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { groups: ['默认分组'], entries: [] };
    if (!localWbData.groups) localWbData.groups = ['默认分组'];
    if (!localWbData.entries) localWbData.entries = [];
    
    const newCharId = Date.now().toString();
    const importedWbIds = [];

    // 1. 如果有世界书，创建新分组并存入
    if (data.worldbook && data.worldbook.length > 0) {
        const groupName = "导入: " + data.char.name;
        if (!localWbData.groups.includes(groupName)) localWbData.groups.push(groupName);
        
        data.worldbook.forEach(entry => {
            entry.group = groupName;
            localWbData.entries.push(entry);
            importedWbIds.push(entry.id);
        });
        // 强制同步写入数据库
        ChatDB.setItem('worldbook_data', JSON.stringify(localWbData));
    }

    // 2. 创建角色对象
    const newChar = {
        id: newCharId,
        name: data.char.name,
        sex: data.char.sex,
        description: data.char.description,
        firstMessage: data.char.firstMessage,
        scenario: data.char.scenario,
        group: currentCharGroupFilter || '默认分组',
        wbEntries: importedWbIds, // 自动绑定刚才导入的所有词条
        avatarUrl: ''
    };

    // 3. 处理头像并保存
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            newChar.avatarUrl = e.target.result;
            chars.push(newChar);
            ChatDB.setItem('chat_chars', JSON.stringify(chars));
            renderCharLibrary();
            if (typeof window.reloadWorldbookData === 'function') window.reloadWorldbookData();
            alert(`角色 [${data.char.name}] 导入成功！\n检测到并迁移了 ${data.worldbook ? data.worldbook.length : 0} 条世界书词条。`);
        };
        reader.readAsDataURL(file);
    } else {
        chars.push(newChar);
        ChatDB.setItem('chat_chars', JSON.stringify(chars));
        renderCharLibrary();
        if (typeof window.reloadWorldbookData === 'function') window.reloadWorldbookData();
        alert(`角色 [${data.char.name}] 导入成功！`);
    }
}


// 4. 点击空白处关闭弹窗
document.addEventListener('click', (e) => {
    const charTitle = document.querySelector('#charLibraryPanel .header-title');
    const createBtn = document.querySelector('#charLibraryPanel .header-close[onclick="toggleCharCreatePopup()"]');
    
    if (charGroupPopup && charGroupPopup.classList.contains('show') && !charGroupPopup.contains(e.target) && e.target !== charTitle) {
        charGroupPopup.classList.remove('show');
    }
    if (charCreatePopup && charCreatePopup.classList.contains('show') && !charCreatePopup.contains(e.target) && e.target !== createBtn) {
        charCreatePopup.classList.remove('show');
    }
});
// ==========================================
// 删除角色逻辑
// ==========================================
function deleteChar(id) {
    if (confirm('确定要删除这个角色卡吗？此操作不可恢复。')) {
        let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        chars = chars.filter(c => c.id !== id);
        ChatDB.setItem('chat_chars', JSON.stringify(chars));
        
        // 重新渲染列表
        if (typeof renderCharLibrary === 'function') {
            renderCharLibrary();
        }
    }
}
// ==========================================
// 世界书选择弹窗逻辑
// ==========================================
function openCharWbSelectModal() {
    const listEl = document.getElementById('charWbSelectList');
    listEl.innerHTML = '';
    
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { groups: [], entries: [] };
    
    if (wbData.groups.length === 0 || wbData.entries.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa; font-size: 12px;">暂无世界书数据</div>';
    } else {
        wbData.groups.forEach(group => {
            const groupEntries = wbData.entries.filter(e => e.group === group);
            if (groupEntries.length === 0) return;
            
            const groupContainer = document.createElement('div');
            groupContainer.style.borderBottom = '1px solid #f5f5f5';
            
            const groupHeader = document.createElement('div');
            groupHeader.style.display = 'flex';
            groupHeader.style.alignItems = 'center';
            groupHeader.style.justifyContent = 'space-between';
            groupHeader.style.padding = '15px 5px';
            groupHeader.style.cursor = 'pointer';
            
            const leftDiv = document.createElement('div');
            leftDiv.style.display = 'flex';
            leftDiv.style.alignItems = 'center';
            leftDiv.style.gap = '12px';
            
            const groupCb = document.createElement('input');
            groupCb.type = 'checkbox';
            // 使用 data 属性代替 class 存储组名，避开选择器特殊字符报错
            groupCb.setAttribute('data-group-target', group);
            groupCb.style.width = '18px';
            groupCb.style.height = '18px';
            groupCb.style.cursor = 'pointer';
            groupCb.style.accentColor = '#333';
            
            const allSelected = groupEntries.every(e => currentSelectedWbEntries.includes(e.id));
            groupCb.checked = allSelected;
            
            groupCb.onclick = (e) => e.stopPropagation();
            
            groupCb.onchange = (e) => {
                const isChecked = e.target.checked;
                // 使用属性选择器，安全处理包含冒号或空格的组名
                document.querySelectorAll(`.wb-entry-checkbox[data-group-name="${group}"]`).forEach(cb => {
                    cb.checked = isChecked;
                    if (isChecked && !currentSelectedWbEntries.includes(cb.value)) {
                        currentSelectedWbEntries.push(cb.value);
                    } else if (!isChecked) {
                        currentSelectedWbEntries = currentSelectedWbEntries.filter(id => id !== cb.value);
                    }
                });
            };
            
            const titleSpan = document.createElement('span');
            titleSpan.innerText = group;
            titleSpan.style.fontSize = '15px';
            titleSpan.style.color = '#333';
            titleSpan.style.fontWeight = '500';
            
            leftDiv.appendChild(groupCb);
            leftDiv.appendChild(titleSpan);
            
            const arrowSvg = document.createElement('div');
            arrowSvg.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#aaa" style="transition: transform 0.2s;"><path d="M7 10l5 5 5-5z"/></svg>`;
            const arrowIcon = arrowSvg.firstChild;
            
            groupHeader.appendChild(leftDiv);
            groupHeader.appendChild(arrowSvg);
            
            const entriesContainer = document.createElement('div');
            entriesContainer.style.display = 'none';
            entriesContainer.style.paddingBottom = '10px';
            
            groupHeader.onclick = () => {
                const isHidden = entriesContainer.style.display === 'none';
                entriesContainer.style.display = isHidden ? 'block' : 'none';
                arrowIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };
            
            groupEntries.forEach(entry => {
                const entryDiv = document.createElement('div');
                entryDiv.style.display = 'flex';
                entryDiv.style.alignItems = 'center';
                entryDiv.style.gap = '12px';
                entryDiv.style.padding = '12px 5px 12px 35px';
                
                const entryCb = document.createElement('input');
                entryCb.type = 'checkbox';
                // 统一 class，使用 data-group-name 标识所属组
                entryCb.className = `wb-entry-checkbox`;
                entryCb.setAttribute('data-group-name', group);
                entryCb.value = entry.id;
                entryCb.checked = currentSelectedWbEntries.includes(entry.id);
                entryCb.style.width = '16px';
                entryCb.style.height = '16px';
                entryCb.style.cursor = 'pointer';
                entryCb.style.accentColor = '#666';
                
                entryCb.onchange = (e) => {
                    if (e.target.checked) {
                        if (!currentSelectedWbEntries.includes(entry.id)) currentSelectedWbEntries.push(entry.id);
                    } else {
                        currentSelectedWbEntries = currentSelectedWbEntries.filter(id => id !== entry.id);
                    }
                    const allCbs = Array.from(document.querySelectorAll(`.wb-entry-checkbox[data-group-name="${group}"]`));
                    const allChecked = allCbs.every(cb => cb.checked);
                    document.querySelector(`input[data-group-target="${group}"]`).checked = allChecked;
                };
                
                const entryTitle = document.createElement('span');
                entryTitle.innerText = entry.title || '未命名';
                entryTitle.style.fontSize = '14px';
                entryTitle.style.color = '#666';
                
                entryDiv.appendChild(entryCb);
                entryDiv.appendChild(entryTitle);
                entriesContainer.appendChild(entryDiv);
            });
            
            groupContainer.appendChild(groupHeader);
            groupContainer.appendChild(entriesContainer);
            listEl.appendChild(groupContainer);
        });
    }
    
    document.getElementById('charWbSelectModalOverlay').classList.add('show');
}

function confirmCharWbSelect() {
    const textEl = document.getElementById('charWbSelectText');
    if (currentSelectedWbEntries.length > 0) {
        textEl.innerText = `已选择 ${currentSelectedWbEntries.length} 个条目`;
        textEl.style.color = '#333';
        textEl.style.fontWeight = 'bold';
    } else {
        textEl.innerText = '正在绑定...';
        textEl.style.color = '#888';
        textEl.style.fontWeight = 'normal';
    }
    
    document.getElementById('charWbSelectModalOverlay').classList.remove('show');
}

// ==========================================
// Secret 弹窗与 API 手动生成逻辑
// ==========================================
let currentSecretCharId = null;

function openSecretModal(charId) {
    currentSecretCharId = charId;
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === charId);
    if (char) {
        const avatarEl = document.getElementById('secretAvatar');
        if (char.avatarUrl) {
            avatarEl.style.backgroundImage = `url(${char.avatarUrl})`;
        } else {
            avatarEl.style.backgroundImage = '';
        }
        
        document.getElementById('secretNetName').innerText = char.netName || '未生成';
        document.getElementById('secretAccount').innerText = char.account || '未生成';
        document.getElementById('secretPassword').innerText = char.password || '未生成';
        
        // 绑定生成按钮事件
        document.getElementById('btnGenerateSecret').onclick = () => generateAccountInfoAPI(charId);
        
        document.getElementById('secretModalOverlay').classList.add('show');
    }
}

async function generateAccountInfoAPI(charId) {
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const charIndex = chars.findIndex(c => c.id === charId);
    if (charIndex === -1) return;
    const char = chars[charIndex];

    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) {
        alert('请先在设置中配置 API 信息！');
        return;
    }

    const btn = document.getElementById('btnGenerateSecret');
    const originalText = btn.innerText;
    btn.innerText = '生成中...';
    btn.style.pointerEvents = 'none';

    try {
        // 核心修改：要求生成 15-50 个通讯录好友（包含群聊），准备存入角色库
        const prompt = `你是一个角色设定助手。请根据以下角色设定，生成该角色的私密账号数据。
包含：
1. 网名(netName)
2. 11位完全随机的数字手机号作为账号(account，必须以1开头)
3. 一段简短感性的个性签名(signature)
4. 8-12位登录密码(password)
5. 6位纯数字支付密码(payPassword)
6. 微信钱包余额(walletBalance，纯数字，精确到小数点后两位，符合其经济水平)
7. 通讯录好友及群聊(contacts，生成 15 至 50 个，包含家人、死党、同事、各种群聊等。注意：数量必须大于15个！)

必须且只能返回JSON，格式如下：
{
  "netName": "xxx",
  "account": "1xxxxxxxxxx",
  "signature": "xxx",
  "password": "xxx",
  "payPassword": "6位纯数字",
  "walletBalance": 520.50,
  "contacts": [
    {"name": "好友或群聊名字", "signature": "个性签名或群公告", "isGroup": false}
  ]
}

角色名称：${char.name}
设定：${char.description}`;
            
        const temp = parseFloat(apiConfig.temperature);
        const finalTemp = isNaN(temp) ? 0.7 : temp;

        const response = await fetch(`${apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.key}`
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: finalTemp
            })
        });

        if (response.ok) {
            const data = await response.json();
            let content = data.choices[0].message.content.trim();
            content = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            
            // 简单的 JSON 截断修复逻辑 (防止生成太多导致末尾括号丢失)
            if (!content.endsWith('}')) {
                const lastBracket = content.lastIndexOf('}');
                if (lastBracket !== -1) {
                    content = content.substring(0, lastBracket + 1);
                } else {
                    content += ']}'; // 暴力补全
                }
            }

            const parsed = JSON.parse(content);
            
            let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
            let finalAccount = parsed.account;

            // 辅助函数：生成 1 开头的 11 位随机数字
            const generateRandomPhone = () => {
                let phone = '1';
                for (let i = 0; i < 10; i++) {
                    phone += Math.floor(Math.random() * 10).toString();
                }
                return phone;
            };

            // 1. 验证 AI 生成的账号是否合法 (1开头，11位纯数字)
            if (!finalAccount || !/^1\d{10}$/.test(finalAccount)) {
                finalAccount = generateRandomPhone();
            }

            // 2. 绝对查重逻辑：如果和现有角色重复，重新生成全新的随机号码，直到不重复为止
            while(allChars.some(c => c.account === finalAccount && c.id !== charId)) {
                finalAccount = generateRandomPhone();
            }

            if (parsed.netName) char.netName = parsed.netName;
            char.account = finalAccount;
            if (parsed.password) char.password = parsed.password;
            if (parsed.signature) char.signature = parsed.signature;
            if (parsed.payPassword && /^\d{6}$/.test(parsed.payPassword)) char.payPassword = parsed.payPassword;
            
            // 更新当前角色信息
            const updateIndex = allChars.findIndex(c => c.id === charId);
            if (updateIndex !== -1) allChars[updateIndex] = char;
            
            // 核心修改：保存钱包余额
            if (parsed.walletBalance !== undefined) {
                ChatDB.setItem(`wallet_balance_${charId}`, parseFloat(parsed.walletBalance).toFixed(2));
            }

            // 核心修改：分离群聊与单人好友，并修复分组刷新逻辑
            if (parsed.contacts && Array.isArray(parsed.contacts)) {
                let currentContacts = JSON.parse(ChatDB.getItem(`contacts_${charId}`) || '[]');
                let npcs = JSON.parse(ChatDB.getItem('chat_npcs') || '[]'); // 用于存群聊
                
                // 自动创建一个专属分组，避免角色库太乱
                const newGroupName = `${char.name}的圈子`;
                // 修复：必须同步更新全局变量 charGroups，否则 UI 不会刷新
                if (typeof charGroups !== 'undefined') {
                    if (!charGroups.includes(newGroupName)) {
                        charGroups.push(newGroupName);
                        ChatDB.setItem('chat_char_groups', JSON.stringify(charGroups));
                    }
                } else {
                    let localGroups = JSON.parse(ChatDB.getItem('chat_char_groups') || '["默认分组"]');
                    if (!localGroups.includes(newGroupName)) {
                        localGroups.push(newGroupName);
                        ChatDB.setItem('chat_char_groups', JSON.stringify(localGroups));
                    }
                }

                parsed.contacts.forEach((contact, idx) => {
                    // 使用时间戳+随机数+索引确保 ID 绝对唯一
                    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5) + idx;
                    
                    if (contact.isGroup) {
                        // 群聊存入 chat_npcs，不进角色库
                        npcs.push({
                            id: newId,
                            name: contact.name || '未命名群聊',
                            netName: contact.name || '未命名群聊',
                            signature: contact.signature || '群聊',
                            description: `这是 ${char.name} 的一个群聊。`,
                            group: '群聊',
                            isNPC: true,
                            isGroup: true,
                            avatarUrl: ''
                        });
                    } else {
                        // 单人好友存入 chat_chars，进入角色库
                        allChars.push({
                            id: newId,
                            name: contact.name || '未命名',
                            netName: contact.name || '未命名',
                            sex: '未知',
                            description: `这是 ${char.name} 的通讯录好友。`,
                            firstMessage: '你好！',
                            scenario: '',
                            avatarUrl: '',
                            group: newGroupName, // 放入专属圈子
                            wbEntries: [],
                            account: '', 
                            password: '',
                            signature: contact.signature || '这个人很懒，什么都没写~',
                            isGroup: false
                        });
                    }
                    currentContacts.push(newId);
                });
                
                ChatDB.setItem('chat_npcs', JSON.stringify(npcs));
                ChatDB.setItem(`contacts_${charId}`, JSON.stringify(currentContacts));
                
                // 刷新角色库 UI
                if (typeof renderCharGroups === 'function') renderCharGroups();
                if (typeof renderCharLibrary === 'function') renderCharLibrary();
            }
            
            // 统一保存所有角色数据
            ChatDB.setItem('chat_chars', JSON.stringify(allChars));
            
            document.getElementById('secretNetName').innerText = char.netName;
            document.getElementById('secretAccount').innerText = char.account;
            document.getElementById('secretPassword').innerText = char.password;
            
            alert(`账号及私密数据生成成功！\n已生成 ${parsed.contacts ? parsed.contacts.length : 0} 个通讯录好友/群聊。\n单人好友已存入角色库的 [${char.name}的圈子] 分组中，群聊已存入通讯录。`);
        } else {
            alert('API 调用失败，请检查配置。');
        }
    } catch (e) {
        console.error('API 请求出错:', e);
        alert('API请求出错: ' + e.message + '\n(可能是生成数量过多导致大模型输出截断，请重试)');
    } finally {
        btn.innerText = originalText;
        btn.style.pointerEvents = 'auto';
    }
}
// 点击空白处关闭 Secret 弹窗
document.addEventListener('click', (e) => {
    const secretOverlay = document.getElementById('secretModalOverlay');
    const secretContent = document.getElementById('secretModalContent');
    
    // 如果弹窗显示着，且点击的目标不是弹窗内容本身，也不是弹窗内部的元素
    if (secretOverlay && secretOverlay.classList.contains('show')) {
        if (secretContent && !secretContent.contains(e.target)) {
            secretOverlay.classList.remove('show');
        }
    }
});

// ==========================================
// 搜索与添加角色至通讯录逻辑
// ==========================================
const searchAddPanel = document.getElementById('searchAddPanel');

function openSearchAddPanel() {
    document.getElementById('searchCharInput').value = '';
    document.getElementById('searchCharResult').innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">输入账号查找角色</div>';
    searchAddPanel.style.display = 'flex';
}

function closeSearchAddPanel() {
    searchAddPanel.style.display = 'none';
}

function handleCharSearch() {
    const keyword = document.getElementById('searchCharInput').value.trim();
    const resultContainer = document.getElementById('searchCharResult');
    
    if (!keyword) {
        resultContainer.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">输入账号查找角色或用户</div>';
        return;
    }

    let allEntities = getAllEntities();
    const currentLoginId = ChatDB.getItem('current_login_account');

    // 过滤掉当前登录账号自己
    const matchedEntities = allEntities.filter(c => c.id !== currentLoginId && c.account && c.account.includes(keyword));

    if (matchedEntities.length === 0) {
        resultContainer.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">未找到该账号对应的角色或用户</div>';
        return;
    }

    resultContainer.innerHTML = '';
    matchedEntities.forEach(char => {
        const card = document.createElement('div');
        card.className = 'wechat-list-item';
        card.style.cursor = 'default';
        const typeTag = char.isAccount ? '<span style="font-size:10px; background:#eee; color:#888; padding:2px 4px; border-radius:4px; margin-left:4px;">用户</span>' : '';
        card.innerHTML = `
            <div class="wechat-avatar" style="background-image: url('${char.avatarUrl || ''}');"></div>
            <div class="wechat-info">
                <div class="wechat-name-time">
                    <span class="wechat-name">${char.netName || char.name}${typeTag}</span>
                </div>
                <div class="wechat-msg">账号: ${char.account}</div>
            </div>
            <div onclick="addCharToContacts('${char.id}')" style="background: #111; color: #fff; padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: bold; cursor: pointer;">添加</div>
        `;
        resultContainer.appendChild(card);
    });
}

function addCharToContacts(charId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert('请先登录！');

    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    
    if (contacts.includes(charId)) {
        alert('该角色已在您的通讯录中！');
        return;
    }

    contacts.push(charId);
    ChatDB.setItem(`contacts_${currentLoginId}`, JSON.stringify(contacts));

    // 核心修改：双向添加，把当前登录人也加到对方的通讯录里
    let targetContacts = JSON.parse(ChatDB.getItem(`contacts_${charId}`) || '[]');
    if (!targetContacts.includes(currentLoginId)) {
        targetContacts.push(currentLoginId);
        ChatDB.setItem(`contacts_${charId}`, JSON.stringify(targetContacts));
    }

    // 初始化互动统计，记录添加日期用于“小幸运”判定
    let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
    if (!stats[charId]) {
        stats[charId] = { 
            streak: 0, lastDate: '', count: 0, pinned: false, special: false, 
            userLastMsg: false, charLastMsg: false, 
            addedDate: new Date().toISOString().split('T')[0], 
            littleLuck: false 
        };
        ChatDB.setItem(`interaction_stats_${currentLoginId}`, JSON.stringify(stats));
    }
    
    // 核心修改：双向初始化对方的互动统计
    let targetStats = JSON.parse(ChatDB.getItem(`interaction_stats_${charId}`) || '{}');
    if (!targetStats[currentLoginId]) {
        targetStats[currentLoginId] = { 
            streak: 0, lastDate: '', count: 0, pinned: false, special: false, 
            userLastMsg: false, charLastMsg: false, 
            addedDate: new Date().toISOString().split('T')[0], 
            littleLuck: false 
        };
        ChatDB.setItem(`interaction_stats_${charId}`, JSON.stringify(targetStats));
    }
    
    alert('添加成功！');
    closeSearchAddPanel();
    
    if (document.getElementById('tab-contacts').style.display === 'flex') {
        if (typeof renderContactList === 'function') renderContactList();
    }
}

// ==========================================
// 全屏聊天页面逻辑 (Chat Room)
// ==========================================
let currentChatRoomCharId = null;

// 格式化时间戳 (如 3:39 PM)
function formatChatTime(timestamp) {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${minutes} ${ampm}`;
}

// ==========================================
// 聊天记录分页与渲染逻辑 (融合 script.js 极致性能优化版)
// ==========================================
let chatDisplayCount = 50; // 像 script.js 一样改为 50 条，提升首屏速度

function renderChatHistory(charId, keepScroll = false) {
    const historyEl = document.getElementById('chatRoomHistory');
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    // 记录旧的滚动高度
    const oldScrollHeight = historyEl.scrollHeight;
    const oldScrollTop = historyEl.scrollTop;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
    
    // 【性能优化】：提取全局变量，避免在循环中重复查找
    let allEntities = getAllEntities();
    const char = allEntities.find(c => c.id === charId);
    const me = allEntities.find(a => a.id === currentLoginId);

    historyEl.innerHTML = '';

    if (history.length === 0) {
        if (char && char.firstMessage) {
            history.push({ role: 'char', content: char.firstMessage, timestamp: Date.now() });
            ChatDB.setItem(`chat_history_${currentLoginId}_${charId}`, JSON.stringify(history));
        } else {
            historyEl.innerHTML = '<div style="text-align: center; color: #ccc; font-size: 12px; margin-top: 20px;">暂无聊天记录</div>';
            return;
        }
    }

    if (!chatDisplayCount) chatDisplayCount = 50;
    const startIndex = Math.max(0, history.length - chatDisplayCount);
    const renderHistory = history.slice(startIndex);

    // 【性能终极优化】：使用 DocumentFragment 在内存中组装 DOM，一次性插入，彻底消灭重绘卡顿！
    const fragment = document.createDocumentFragment();

    if (startIndex > 0) {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.style.cssText = 'text-align: center; padding: 15px 0; color: #576b95; font-size: 13px; cursor: pointer; font-weight: bold;';
        loadMoreBtn.innerText = '点击加载更多历史记录';
        loadMoreBtn.onclick = () => {
            chatDisplayCount += 50;
            renderChatHistory(charId, true);
        };
        fragment.appendChild(loadMoreBtn);
    }

    // 提取头像为全局 CSS 类，避免 Base64 重复拼接
    let avatarStyleTag = document.getElementById('chat-avatar-dynamic-style');
    if (!avatarStyleTag) {
        avatarStyleTag = document.createElement('style');
        avatarStyleTag.id = 'chat-avatar-dynamic-style';
        document.head.appendChild(avatarStyleTag);
    }
    const meAvatarUrl = me ? me.avatarUrl : '';
    const charAvatarUrl = char ? char.avatarUrl : '';
    avatarStyleTag.innerHTML = `
        .cr-avatar-me-bg { background-image: url('${meAvatarUrl}'); }
        .cr-avatar-char-bg { background-image: url('${charAvatarUrl}'); }
    `;

    renderHistory.forEach((msg, i) => {
        const index = startIndex + i;
        const prevMsg = renderHistory[i - 1];
        const nextMsg = renderHistory[i + 1];

        let showTime = false;
        if (!prevMsg || msg.timestamp - prevMsg.timestamp > 5 * 60 * 1000) {
            showTime = true;
        }

        let isContinuous = false;
        if (nextMsg && nextMsg.role === msg.role && (nextMsg.timestamp - msg.timestamp < 5 * 60 * 1000)) {
            isContinuous = true;
        }
        
        let isFollowUp = false;
        if (prevMsg && prevMsg.role === msg.role && (msg.timestamp - prevMsg.timestamp < 5 * 60 * 1000)) {
            isFollowUp = true;
        }

        if (showTime) {
            const timeEl = document.createElement('div');
            timeEl.className = 'chat-time';
            timeEl.innerText = formatChatTime(msg.timestamp);
            fragment.appendChild(timeEl);
        }

        const containerEl = document.createElement('div');
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.width = '100%';

        const rowEl = document.createElement('div');
        rowEl.className = `cr-msg-row ${msg.role === 'user' ? 'me' : 'other'} ${isFollowUp ? 'continuous' : ''}`;
        
        rowEl.onclick = () => {
            if (isChatMultiSelecting) toggleMsgSelection(index, rowEl);
        };

        const isUser = msg.role === 'user';
        const hasAvatar = isUser ? meAvatarUrl : charAvatarUrl;
        const avatarClass = isUser ? 'cr-avatar-me-bg' : 'cr-avatar-char-bg';
        
        const avatarHtml = `
            <div class="cr-avatar ${avatarClass} ${isContinuous ? 'hidden' : ''}">
                ${!hasAvatar ? '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' : ''}
            </div>
        `;

        const safeContent = msg.content || '';
        const isImageMsg = safeContent.includes('chat-img-120') || safeContent.includes('chat-desc-img-120') || (safeContent.trim().startsWith('<img') && safeContent.trim().endsWith('>'));
        const isForwardRecord = msg.type === 'forward_record';
        const isVoiceMsg = msg.type === 'voice';
        const isTransferMsg = msg.type === 'transfer'; 
        const isFamilyCardMsg = msg.type === 'family_card'; 
        const isMusicInviteMsg = msg.type === 'music_invite';
        const isMusicShareMsg = safeContent.includes('music-share-card'); // 识别分享卡片
        const isSystemMsg = msg.type === 'system'; // 识别系统提示
        const isHiddenSystemMsg = msg.type === 'hidden_system'; // 识别隐藏系统提示

        if (isHiddenSystemMsg) return; // 跳过渲染，不在界面上显示

        // 如果是系统消息，直接渲染居中灰色小字
        if (isSystemMsg) {
            const sysContainer = document.createElement('div');
            sysContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 100%; margin: 10px 0;';

            const sysEl = document.createElement('div');
            sysEl.style.cssText = 'text-align: center; font-size: 11px; color: #aaa; background: rgba(0,0,0,0.05); padding: 4px 10px; border-radius: 10px; max-width: 80%;';
            sysEl.innerText = safeContent;
            
            if (msg.originalContent) {
                sysEl.style.cursor = 'pointer';
                sysEl.title = '点击查看撤回内容';
                sysEl.onclick = () => {
                    const detailEl = sysContainer.querySelector('.recall-detail');
                    if (detailEl) {
                        detailEl.style.display = detailEl.style.display === 'none' ? 'block' : 'none';
                    }
                };
                
                const detailEl = document.createElement('div');
                detailEl.className = 'recall-detail';
                detailEl.style.cssText = 'display: none; margin-top: 6px; font-size: 12px; color: #888; background: #f4f4f4; padding: 8px 12px; border-radius: 8px; max-width: 80%; word-break: break-all; border: 1px dashed #ccc;';
                
                // 过滤掉图片标签等，只显示纯文本或提示
                let cleanOriginal = msg.originalContent.replace(/<img[^>]*>/g, '[图片/表情包]').replace(/<[^>]+>/g, '');
                if (msg.originalContent.includes('chat-desc-img-120')) cleanOriginal = '[图片]';
                if (msg.originalContent.includes('cr-voice-bubble')) cleanOriginal = '[语音]';
                
                detailEl.innerText = `撤回内容：${cleanOriginal}`;
                
                sysContainer.appendChild(sysEl);
                sysContainer.appendChild(detailEl);
            } else {
                sysContainer.appendChild(sysEl);
            }
            
            fragment.appendChild(sysContainer);
            return; // 跳过后续普通气泡渲染
        }

        let quoteHtml = '';
        if (msg.quote) {
            quoteHtml = `<div class="cr-quote-block">${msg.quote}</div>`;
        }

        const checkboxHtml = `<input type="checkbox" class="cr-msg-checkbox" value="${index}">`;

        let bubbleInnerHtml = safeContent;
        
        if (isImageMsg && bubbleInnerHtml.includes('<div class="img-icon">🖼️</div>')) {
            bubbleInnerHtml = bubbleInnerHtml.replace(/<div class="img-icon">🖼️<\/div>/g, '');
        }

        if (isForwardRecord) {
            bubbleInnerHtml = `
                <div class="cr-forward-card" onclick="event.stopPropagation(); openForwardDetail(${index})">
                    <div class="cr-forward-title">${msg.forwardTitle}</div>
                    <div class="cr-forward-preview">
                        ${msg.forwardPreview.map(line => `<div class="cr-forward-preview-line">${line}</div>`).join('')}
                    </div>
                    <div class="cr-forward-footer">聊天记录</div>
                </div>
            `;
        } else if (isVoiceMsg) {
            const voiceLength = Math.max(1, Math.min(60, Math.floor(msg.content.length / 2))); 
            const voiceWidth = 60 + voiceLength * 2; 
            bubbleInnerHtml = `
                <div class="cr-voice-bubble" style="width: ${voiceWidth}px;" onclick="event.stopPropagation(); toggleVoiceText(${index})">
                    <div class="voice-waves ${msg.role === 'user' ? 'me' : 'other'}">
                        <span class="wave"></span><span class="wave"></span><span class="wave"></span><span class="wave"></span>
                    </div>
                    <span class="voice-duration">${voiceLength}"</span>
                </div>
            `;
        } else if (isTransferMsg) {
            const isReceived = msg.status === 'received';
            const isRejected = msg.status === 'rejected' || msg.status === 'refunded';
            let iconHtml = `¥`;
            let descText = msg.note || (msg.role === 'user' ? '转账给对方' : '转账给你');
            let cardClass = '';

            if (isReceived) {
                iconHtml = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                descText = '已收款';
                cardClass = 'received';
            } else if (isRejected) {
                iconHtml = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>`;
                descText = '已退还';
                cardClass = 'received'; 
            }

            bubbleInnerHtml = `
                <div class="transfer-card ${cardClass}" onclick="event.stopPropagation(); handleTransferClick(${index})">
                    <div class="transfer-card-top">
                        <div class="transfer-icon">${iconHtml}</div>
                        <div class="transfer-info">
                            <div class="transfer-amount">¥ ${msg.amount}</div>
                            <div class="transfer-desc">${descText}</div>
                        </div>
                    </div>
                    <div class="transfer-card-bottom">微信转账</div>
                </div>
            `;
        } else if (isFamilyCardMsg) {
            const isGift = msg.subType === 'gift';
            const isReceived = msg.status === 'received';
            let titleText = isGift ? (msg.role === 'user' ? '送你一张亲属卡' : '送你一张亲属卡') : '向你索要亲属卡';
            let statusText = isReceived ? '你已领取' : (msg.role === 'user' ? '等待对方领取' : '点击查看详情');
            if (!isGift && isReceived) statusText = '已开通';

            bubbleInnerHtml = `
                <div class="bubble-family-premium" onclick="event.stopPropagation(); handleFamilyCardClick(${index})">
                    <div class="bfp-top">
                        <div class="bfp-icon-wrap">
                            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                        <div class="bfp-info">
                            <div class="bfp-title">${titleText}</div>
                            <div class="bfp-status">${statusText}</div>
                        </div>
                    </div>
                    <div class="bfp-bottom">亲属卡</div>
                </div>
            `;
        } else if (isMusicInviteMsg) {
            let statusText = msg.status === 'accepted' ? '已同意' : (msg.status === 'rejected' ? '已拒绝' : '等待回复...');
            bubbleInnerHtml = `
                <div class="music-invite-card" onclick="event.stopPropagation(); openMusicInviteDetail(${index})">
                    <div class="music-invite-card-top">
                        <div class="music-invite-icon">
                            <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                        </div>
                        <div class="music-invite-info">
                            <div class="music-invite-title">邀请你一起听歌</div>
                            <div class="music-invite-desc">${statusText}</div>
                        </div>
                    </div>
                    <div class="music-invite-card-bottom">网易云音乐</div>
                </div>
            `;
        }

        const bubbleHtml = `
            <div class="cr-msg-content-wrapper">
                ${quoteHtml}
                <div class="cr-bubble ${msg.role === 'user' ? 'cr-bubble-right' : 'cr-bubble-left'} ${isContinuous ? 'no-tail' : ''} ${isImageMsg ? 'cr-bubble-image' : ''} ${isForwardRecord ? 'cr-bubble-forward' : ''} ${isVoiceMsg ? 'cr-bubble-voice-wrap' : ''} ${isTransferMsg ? 'cr-bubble-transfer' : ''} ${isFamilyCardMsg ? 'cr-bubble-family' : ''} ${isMusicInviteMsg ? 'cr-bubble-music-invite' : ''} ${isMusicShareMsg ? 'cr-bubble-music-share' : ''}" 
                     oncontextmenu="return false;" 
                     ontouchstart="handleBubbleTouchStart(event, ${index})" 
                     ontouchend="handleBubbleTouchEnd()" 
                     ontouchmove="handleBubbleTouchEnd()"
                     onmousedown="handleBubbleTouchStart(event, ${index})"
                     onmouseup="handleBubbleTouchEnd()"
                     onmouseleave="handleBubbleTouchEnd()"
                     ${isImageMsg ? `onclick="event.stopPropagation(); openImageDetail(${index})"` : ''}>
                    ${bubbleInnerHtml}
                </div>
            </div>
        `;

        if (msg.role === 'user') {
            rowEl.innerHTML = checkboxHtml + bubbleHtml + avatarHtml;
        } else {
            rowEl.innerHTML = checkboxHtml + avatarHtml + bubbleHtml;
        }

        containerEl.appendChild(rowEl);

        const smallTimeEl = document.createElement('div');
        smallTimeEl.className = 'cr-small-time'; 
        smallTimeEl.style.fontSize = '10px';
        smallTimeEl.style.color = '#bbb';
        smallTimeEl.style.marginTop = '2px';
        smallTimeEl.style.marginBottom = '2px';
        smallTimeEl.style.fontWeight = '600';
        if (msg.role === 'user') {
            smallTimeEl.style.textAlign = 'right';
            smallTimeEl.style.paddingRight = '52px';
        } else {
            smallTimeEl.style.textAlign = 'left';
            smallTimeEl.style.paddingLeft = '52px';
        }
        smallTimeEl.innerText = formatChatTime(msg.timestamp);
        containerEl.appendChild(smallTimeEl);

        if (isVoiceMsg) {
            const voicePreview = document.createElement('div');
            voicePreview.id = `voice-text-${index}`;
            voicePreview.className = 'cr-voice-text-preview';
            voicePreview.style.display = 'none';
            voicePreview.style.alignSelf = msg.role === 'user' ? 'flex-end' : 'flex-start';
            voicePreview.style.margin = msg.role === 'user' ? '4px 52px 0 0' : '4px 0 0 52px';
            voicePreview.style.backgroundColor = msg.role === 'user' ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)';
            voicePreview.style.color = msg.role === 'user' ? '#333' : '#555';
            voicePreview.innerText = msg.content;
            containerEl.appendChild(voicePreview);
        }

        fragment.appendChild(containerEl);
    });

    // 一次性将所有组装好的 DOM 插入页面
    historyEl.appendChild(fragment);

    // 滚动控制逻辑 (与 script.js 保持一致)
    requestAnimationFrame(() => {
        if (keepScroll) {
            historyEl.scrollTop = historyEl.scrollHeight - oldScrollHeight + oldScrollTop;
        } else {
            historyEl.scrollTop = historyEl.scrollHeight;
        }
    });
}
// 处理聊天输入框的键盘事件（回车发送）
function handleChatInputKeydown(event) {
    // 如果按下的是 Enter 键，并且没有按 Shift 键
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 阻止默认的换行行为
        sendChatMessage();      // 调用发送消息函数
    }
}

// 发送消息逻辑 (异步非阻塞极致流畅版)
function sendChatMessage() {
    const inputEl = document.getElementById('chatRoomInput');
    const content = inputEl.value.trim();
    if (!content || !currentChatRoomCharId) return;

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let newMsg = { role: 'user', content: content, timestamp: Date.now() };
    if (currentQuoteText) {
        newMsg.quote = currentQuoteText;
        cancelQuote(); 
    }

    // 1. 立即清空输入框，解除主线程阻塞，给用户“秒发”的极致流畅反馈
    inputEl.value = '';

    // 2. 将极其耗时的 JSON 读写和 DOM 全量渲染扔进异步队列，延迟 10ms 执行
    setTimeout(() => {
        // 存入当前账号的视角
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        history.push(newMsg);
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        
        let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
        sessions = sessions.filter(id => id !== currentChatRoomCharId);
        sessions.unshift(currentChatRoomCharId);
        ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));

        // 【新增】：左手倒右手双向同步 (无论对方是User还是Char，保证关联账号能代收消息)
        let allEntities = getAllEntities();
        const targetEntity = allEntities.find(e => e.id === currentChatRoomCharId);
        if (targetEntity) {
            // 存入对方账号的视角
            let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
            // 在对方视角里，这条消息是我发来的，所以 role 是 'char'
            let targetMsg = { ...newMsg, role: 'char' };
            targetHistory.push(targetMsg);
            ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

            let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
            targetSessions = targetSessions.filter(id => id !== currentLoginId);
            targetSessions.unshift(currentLoginId);
            ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));
            
            // 增加对方视角的未读数
            let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
            ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
        }
        
        if (typeof renderChatList === 'function') renderChatList();
        
        // 在后台完成数据保存后，再渲染聊天界面
        renderChatHistory(currentChatRoomCharId);
        
        // 同步刷新音乐APP的聊天室
        if (document.getElementById('musicChatPanel') && document.getElementById('musicChatPanel').style.display === 'flex' && typeof window.currentListenTogetherCharId !== 'undefined' && window.currentListenTogetherCharId === currentChatRoomCharId) {
            if (typeof renderMusicChatHistory === 'function') renderMusicChatHistory();
        }
        
        // 新增：更新互动数据
        updateInteractionStats(currentChatRoomCharId, true);

        // --- 新增：触发 Char 感知系统 ---
        injectCharPerception('send_msg', content, currentChatRoomCharId);
        // -------------------------------
    }, 10);
}

function openChatRoom(charId) {
    currentChatRoomCharId = charId;
    chatDisplayCount = 80; // 每次进入重置为第一页
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (currentLoginId) {
        ChatDB.setItem(`unread_${currentLoginId}_${charId}`, '0');
        if (typeof renderChatList === 'function') renderChatList(); // 刷新列表消除红点
    }
    
    let allEntities = getAllEntities();
    const char = allEntities.find(c => c.id === charId);
    
    // 核心修改：统一从所有实体中获取“我”，完美兼容 User 和 Char 登录
    const me = allEntities.find(a => a.id === currentLoginId);
    
    if (char) {
        let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
        const displayName = remarks[charId] || char.netName || char.name || '未命名';
        
        const wornBadgeHtml = getWornBadgeHtml(charId);
        document.getElementById('chatRoomTitle').innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${displayName}${wornBadgeHtml}</span>`;
        
        document.getElementById('crHeaderAvatarMe').style.backgroundImage = `url('${me ? me.avatarUrl : ''}')`;
        const charAvatarEl = document.getElementById('crHeaderAvatarChar');
        charAvatarEl.style.backgroundImage = `url('${char.avatarUrl || ''}')`;
        
        // 点击头像：打开心声面板查看最后一次的心声
        charAvatarEl.onclick = () => {
            const lastVoice = ChatDB.getItem(`last_inner_voice_${currentChatRoomCharId}`);
            if (lastVoice) {
                playInnerVoiceAnimation(lastVoice);
            } else {
                alert('暂无心声记录');
            }
        };

        // 【新增】：如果对方是用户账号(小号)，隐藏 AI 回复按钮
        const apiBtn = document.querySelector('.cr-api-btn');
        if (apiBtn) {
            if (char.isAccount) {
                apiBtn.style.display = 'none';
            } else {
                apiBtn.style.display = 'flex';
            }
        }
        
        document.getElementById('chatRoomInput').value = '';
        closeChatPanels(); 
        
        // 【终极流畅修复】：移除 requestAnimationFrame 阻塞，直接显示面板并渲染，与流畅版项目保持一致
        document.getElementById('chatRoomPanel').style.display = 'flex';
        updateChatRoomAppearance(); 
        renderChatHistory(charId);
    }
}

function closeChatRoom() {
    document.getElementById('chatRoomPanel').style.display = 'none';
    currentChatRoomCharId = null;
}
// ==========================================
// 角色详情主页逻辑 (仿微信他人主页)
// ==========================================
let currentProfileCharId = null;

function openCharProfilePanel(charId) {
    currentProfileCharId = charId;
    let chars = getAllEntities();
    const char = chars.find(c => c.id === charId);
    
    if (char) {
        const avatarEl = document.getElementById('cpAvatar');
        avatarEl.style.backgroundImage = char.avatarUrl ? `url(${char.avatarUrl})` : '';
        
        // 获取当前登录账号对该角色的备注
        const currentLoginId = ChatDB.getItem('current_login_account');
        let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
        const remark = remarks[charId] || '';

        // 如果有备注，名字显示为：备注(原始名)，否则显示原始名
        const baseName = char.netName || char.name || '未命名';
        document.getElementById('cpName').innerText = remark ? `${remark} (${baseName})` : baseName;
        document.getElementById('cpRemarkValue').innerText = remark || '未设置';
        
        document.getElementById('cpAccount').innerText = '账号: ' + (char.account || '未设置');
        
        // 修改点：这里显示真实的 signature 字段，而不是 description(人设)
        document.getElementById('cpSign').innerText = char.signature || '该用户很懒，还没有写下签名。';
        
        document.getElementById('charProfilePanel').style.display = 'flex';
    }
}

// 新增函数：编辑备注
function editCharRemark() {
    if (!currentProfileCharId) return;
    const currentLoginId = ChatDB.getItem('current_login_account');
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    
    const oldRemark = remarks[currentProfileCharId] || '';
    const newRemark = prompt('请输入备注名称（留空则删除备注）：', oldRemark);
    
    if (newRemark !== null) {
        if (newRemark.trim() === '') {
            delete remarks[currentProfileCharId];
        } else {
            remarks[currentProfileCharId] = newRemark.trim();
        }
        ChatDB.setItem(`char_remarks_${currentLoginId}`, JSON.stringify(remarks));
        openCharProfilePanel(currentProfileCharId); // 刷新详情页
        if (typeof renderChatList === 'function') renderChatList(); // 刷新聊天列表
        if (typeof renderContactList === 'function') renderContactList(); // 刷新通讯录
    }
}

function closeCharProfilePanel() {
    document.getElementById('charProfilePanel').style.display = 'none';
}

function startChatWithChar() {
    if (!currentProfileCharId) return;
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert('请先登录！');

    // 1. 确保角色在通讯录中
    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    if (!contacts.includes(currentProfileCharId)) {
        contacts.push(currentProfileCharId);
        ChatDB.setItem(`contacts_${currentLoginId}`, JSON.stringify(contacts));
    }

    // 2. 确保角色在会话列表中
    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    if (!sessions.includes(currentProfileCharId)) {
        sessions.unshift(currentProfileCharId); // 添加到列表顶部
        ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));
    }

    // 3. 关闭详情面板，切换到聊天列表 Tab，并刷新列表
    closeCharProfilePanel();
    switchWechatTab('chat');
    
    // 4. 直接打开全屏聊天页面
    openChatRoom(currentProfileCharId); 
}

// 清空聊天记录逻辑
function clearChatHistory() {
    if (!currentProfileCharId) return;
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert('请先登录！');

    if (confirm('确定要清空与该角色的所有聊天记录吗？此操作不可恢复。')) {
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentProfileCharId}`, JSON.stringify([]));
        alert('聊天记录已清空！');
        if (typeof renderChatList === 'function') renderChatList(); // 刷新外层聊天列表
    }
}

// 删除好友逻辑
function deleteContactChar() {
    if (!currentProfileCharId) return;
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert('请先登录！');

    if (confirm('确定要将该角色从通讯录中删除吗？（删除后可通过搜索账号重新添加）')) {
        // 1. 从通讯录中移除 (双向移除)
        let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
        contacts = contacts.filter(id => id !== currentProfileCharId);
        ChatDB.setItem(`contacts_${currentLoginId}`, JSON.stringify(contacts));
        
        let targetContacts = JSON.parse(ChatDB.getItem(`contacts_${currentProfileCharId}`) || '[]');
        targetContacts = targetContacts.filter(id => id !== currentLoginId);
        ChatDB.setItem(`contacts_${currentProfileCharId}`, JSON.stringify(targetContacts));
        
        // 2. 从会话列表中一并移除
        let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
        sessions = sessions.filter(id => id !== currentProfileCharId);
        ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));

        // 3. 彻底清除该角色的互动标识统计数据 (确保重新添加时完全重置)
        let stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}');
        if (stats[currentProfileCharId]) {
            delete stats[currentProfileCharId];
            ChatDB.setItem(`interaction_stats_${currentLoginId}`, JSON.stringify(stats));
        }
        
        // 核心修改：双向清除对方的互动标识统计数据
        let targetStats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentProfileCharId}`) || '{}');
        if (targetStats[currentLoginId]) {
            delete targetStats[currentLoginId];
            ChatDB.setItem(`interaction_stats_${currentProfileCharId}`, JSON.stringify(targetStats));
        }
        
        // --- 新增：触发 Char 感知系统 ---
        injectCharPerception('delete_friend', '', currentProfileCharId);
        // -------------------------------

        alert('已删除好友！');
        closeCharProfilePanel();
        
        // 4. 同步刷新通讯录和会话列表
        if (typeof renderContactList === 'function') renderContactList();
        if (typeof renderChatList === 'function') renderChatList();
    }
}

// ==========================================
// 表情包管理逻辑
// ==========================================
let emojiGroups = JSON.parse(ChatDB.getItem('chat_emoji_groups') || '["默认分组"]');
let currentEmojiGroup = '默认分组';
let isEmojiGroupEditing = false;
let isEmojiEditing = false;

function openEmojiManagerPanel() {
    document.getElementById('emojiManagerPanel').style.display = 'flex';
    document.getElementById('emojiImportInput').value = '';
    isEmojiEditing = false;
    document.getElementById('emojiEditBtn').innerText = 'Edit';
    renderEmojiGroups();
    renderEmojis();
}

function closeEmojiManagerPanel() {
    document.getElementById('emojiManagerPanel').style.display = 'none';
    document.getElementById('emojiGroupPopup').classList.remove('show');
}

// --- 分组逻辑 ---
function toggleEmojiGroupPopup() {
    document.getElementById('emojiGroupPopup').classList.toggle('show');
}

function toggleEmojiGroupEditMode() {
    isEmojiGroupEditing = !isEmojiGroupEditing;
    const btn = document.getElementById('emojiGroupEditBtn');
    const popup = document.getElementById('emojiGroupPopup');
    if (isEmojiGroupEditing) {
        popup.classList.add('is-editing');
        btn.innerText = 'Done';
    } else {
        popup.classList.remove('is-editing');
        btn.innerText = 'Edit';
    }
}

function renderEmojiGroups() {
    const listEl = document.getElementById('emojiGroupList');
    listEl.innerHTML = '';
    emojiGroups.forEach(g => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `
            <span class="preset-item-name">${g}</span>
            <div class="preset-delete-btn" onclick="deleteEmojiGroup('${g}', event)">-</div>
        `;
        item.onclick = () => {
            if (!isEmojiGroupEditing) {
                currentEmojiGroup = g;
                document.getElementById('emojiCurrentGroupText').innerText = g;
                document.getElementById('emojiGroupPopup').classList.remove('show');
                renderEmojis();
            }
        };
        listEl.appendChild(item);
    });
}

function promptAddEmojiGroup() {
    openGlobalPrompt('新建分组', '请输入新分组名称', '⸝⸝⸝ ╸▵╺⸝⸝⸝', (name) => {
        if (name && name.trim() !== "") {
            if (emojiGroups.includes(name.trim())) return alert('分组已存在！');
            emojiGroups.push(name.trim());
            ChatDB.setItem('chat_emoji_groups', JSON.stringify(emojiGroups));
            renderEmojiGroups();
        }
    });
}

function deleteEmojiGroup(groupName, e) {
    e.stopPropagation();
    if (groupName === '默认分组') return alert('默认分组不可删除！');
    if (confirm(`确定删除分组 [${groupName}] 吗？该分组下的表情包将被移至默认分组。`)) {
        emojiGroups = emojiGroups.filter(g => g !== groupName);
        ChatDB.setItem('chat_emoji_groups', JSON.stringify(emojiGroups));
        
        let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
        emojis.forEach(em => { if (em.group === groupName) em.group = '默认分组'; });
        ChatDB.setItem('chat_emojis', JSON.stringify(emojis));
        
        if (currentEmojiGroup === groupName) {
            currentEmojiGroup = '默认分组';
            document.getElementById('emojiCurrentGroupText').innerText = '默认分组';
        }
        renderEmojiGroups();
        renderEmojis();
    }
}

// --- 导入与渲染逻辑 ---
function openEmojiImportModal() {
    document.getElementById('emojiImportInput').value = '';
    document.getElementById('emojiImportModalOverlay').classList.add('show');
}

function closeEmojiImportModal() {
    document.getElementById('emojiImportModalOverlay').classList.remove('show');
}

function handleEmojiFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        if (file.name.endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
                let addedCount = 0;
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        if (item.desc && item.url) {
                            emojis.push({
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                desc: item.desc,
                                url: item.url,
                                group: currentEmojiGroup
                            });
                            addedCount++;
                        }
                    });
                }
                if (addedCount > 0) {
                    ChatDB.setItem('chat_emojis', JSON.stringify(emojis));
                    alert(`成功导入 ${addedCount} 个表情包！`);
                    renderEmojis();
                    closeEmojiImportModal();
                } else {
                    alert('未在 JSON 中找到有效的表情包数据。');
                }
            } catch (err) {
                alert('JSON 解析失败，请确保格式正确。');
            }
        } else {
            // txt 格式，直接填入 textarea 让用户确认
            document.getElementById('emojiImportInput').value = content;
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function importEmojis() {
    const input = document.getElementById('emojiImportInput').value.trim();
    if (!input) return alert('请输入表情包信息！');

    let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
    const lines = input.split('\n');
    let addedCount = 0;

    lines.forEach(line => {
        // 支持中英文冒号分割
        const parts = line.split(/[:：]/);
        if (parts.length >= 2) {
            const desc = parts[0].trim();
            // URL可能包含冒号(https:)，所以要把后面的部分重新拼起来
            const url = parts.slice(1).join(':').trim();
            if (desc && url) {
                emojis.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    desc: desc,
                    url: url,
                    group: currentEmojiGroup
                });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        ChatDB.setItem('chat_emojis', JSON.stringify(emojis));
        document.getElementById('emojiImportInput').value = '';
        alert(`成功导入 ${addedCount} 个表情包！`);
        renderEmojis();
        closeEmojiImportModal();
    } else {
        alert('未识别到有效的表情包格式，请检查输入！');
    }
}

let selectedEmojiIds = []; // 记录选中的表情包ID

function toggleEmojiEditMode() {
    isEmojiEditing = !isEmojiEditing;
    const btn = document.getElementById('emojiEditBtn');
    const grid = document.getElementById('emojiGrid');
    const actionBar = document.getElementById('emojiBatchActionBar');
    
    if (isEmojiEditing) {
        btn.innerText = 'Done';
        grid.classList.add('is-editing');
        actionBar.style.display = 'flex';
        selectedEmojiIds = []; // 进入编辑模式时清空选中
    } else {
        btn.innerText = 'Edit';
        grid.classList.remove('is-editing');
        actionBar.style.display = 'none';
        selectedEmojiIds = []; // 退出时清空选中
    }
    renderEmojis(); // 重新渲染以更新点击事件和UI
}

function renderEmojis() {
    const grid = document.getElementById('emojiGrid');
    grid.innerHTML = '';
    
    // 始终在最前面渲染一个“添加”按钮
    const addBtn = document.createElement('div');
    addBtn.className = 'emoji-manager-item';
    addBtn.innerHTML = `
        <div class="emoji-manager-img" style="background: #f4f4f4; display: flex; justify-content: center; align-items: center; cursor: pointer; border: 1px dashed #ccc;" onclick="openEmojiImportModal()">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#aaa" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="emoji-manager-desc">导入表情包</div>
    `;
    grid.appendChild(addBtn);
    
    let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
    let currentEmojis = emojis.filter(e => e.group === currentEmojiGroup);

    if (currentEmojis.length === 0) {
        const emptyHint = document.createElement('div');
        emptyHint.style.cssText = 'grid-column: 1 / -1; text-align: center; color: #aaa; font-size: 12px; padding: 20px 0;';
        emptyHint.innerText = '当前分组暂无表情包';
        grid.appendChild(emptyHint);
        return;
    }

    currentEmojis.forEach(em => {
        const item = document.createElement('div');
        item.className = 'emoji-manager-item';
        
        const isSelected = selectedEmojiIds.includes(em.id);
        if (isEmojiEditing && isSelected) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="emoji-manager-img" style="background-image: url('${em.url}');"></div>
            <div class="emoji-manager-desc">${em.desc}</div>
            ${isEmojiEditing ? `<div class="emoji-select-badge">${isSelected ? '✓' : ''}</div>` : ''}
        `;

        if (isEmojiEditing) {
            item.onclick = () => toggleEmojiSelection(em.id);
        }

        grid.appendChild(item);
    });
}

function toggleEmojiSelection(id) {
    if (selectedEmojiIds.includes(id)) {
        selectedEmojiIds = selectedEmojiIds.filter(i => i !== id);
    } else {
        selectedEmojiIds.push(id);
    }
    renderEmojis();
}

function batchDeleteEmojis() {
    if (selectedEmojiIds.length === 0) return alert('请先选择要删除的表情包！');
    if (confirm(`确定要删除选中的 ${selectedEmojiIds.length} 个表情包吗？`)) {
        let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
        emojis = emojis.filter(e => !selectedEmojiIds.includes(e.id));
        ChatDB.setItem('chat_emojis', JSON.stringify(emojis));
        selectedEmojiIds = [];
        renderEmojis();
    }
}

function openEmojiMoveModal() {
    if (selectedEmojiIds.length === 0) return alert('请先选择要移动的表情包！');
    
    const listEl = document.getElementById('emojiMoveGroupList');
    listEl.innerHTML = '';
    
    emojiGroups.forEach(g => {
        if (g === currentEmojiGroup) return; // 不显示当前分组
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `<span class="preset-item-name">${g}</span>`;
        item.onclick = () => confirmMoveEmojis(g);
        listEl.appendChild(item);
    });

    if (listEl.innerHTML === '') {
        listEl.innerHTML = '<div style="padding: 15px; text-align: center; color: #aaa; font-size: 12px;">暂无其他分组可移动</div>';
    }

    document.getElementById('emojiMoveModalOverlay').classList.add('show');
}

function closeEmojiMoveModal() {
    document.getElementById('emojiMoveModalOverlay').classList.remove('show');
}

function confirmMoveEmojis(targetGroup) {
    let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
    emojis.forEach(e => {
        if (selectedEmojiIds.includes(e.id)) {
            e.group = targetGroup;
        }
    });
    ChatDB.setItem('chat_emojis', JSON.stringify(emojis));
    
    alert(`成功将 ${selectedEmojiIds.length} 个表情包移动至 [${targetGroup}]`);
    selectedEmojiIds = [];
    closeEmojiMoveModal();
    toggleEmojiEditMode(); // 移动完成后自动退出编辑模式
}

// 点击空白处关闭分组弹窗
document.addEventListener('click', (e) => {
    const popup = document.getElementById('emojiGroupPopup');
    const title = document.querySelector('#emojiManagerPanel .header-title');
    if (popup && popup.classList.contains('show') && !popup.contains(e.target) && !title.contains(e.target)) {
        popup.classList.remove('show');
    }
});

// ==========================================
// 聊天室底部面板切换逻辑
// ==========================================

let chatRoomCurrentEmojiGroup = '默认分组'; // 新增：记录聊天室当前表情包分组

function toggleChatPanel(type) {
    const morePanel = document.getElementById('crMorePanel');
    const emojiPanel = document.getElementById('crEmojiPanel');
    
    if (type === 'more') {
        // 核心修改：判断是否为 Char 登录，如果是则隐藏查手机按钮
        const currentLoginId = ChatDB.getItem('current_login_account');
        const isChar = !getAllEntities().find(e => e.id === currentLoginId)?.isAccount;
        const phoneCheckBtn = document.getElementById('more-btn-phone-check');
        if (phoneCheckBtn) {
            phoneCheckBtn.style.display = isChar ? 'none' : 'flex';
        }

        if (morePanel.classList.contains('show')) {
            morePanel.classList.remove('show');
        } else {
            morePanel.classList.add('show');
            emojiPanel.classList.remove('show');
        }
    } else if (type === 'emoji') {
        if (emojiPanel.classList.contains('show')) {
            emojiPanel.classList.remove('show');
        } else {
            renderChatRoomEmojis(); 
            emojiPanel.classList.add('show');
            morePanel.classList.remove('show');
        }
    }
}

// 处理更多面板功能点击
function handleMoreAction(action) {
    closeChatPanels();
    if (action === 'roll') {
        executeRollRedo();
    } else if (action === 'image') {
        document.getElementById('sendImageModalOverlay').classList.add('show');
    } else if (action === 'camera') {
        // 直接触发隐藏的拍照 input，唤起摄像头
        document.getElementById('chatCameraInput').click();
    } else if (action === 'voice') {
        document.getElementById('voiceTextInput').value = '';
        document.getElementById('sendVoiceModalOverlay').classList.add('show');
    } else if (action === 'transfer') {
        openTransferPanel(); // 新增：打开转账面板
    } else if (action === 'familycard') {
        // 新增：亲属卡逻辑
        switchFcTab('gift');
        document.getElementById('familyCardLimitInput').value = '';
        document.getElementById('sendFamilyCardModalOverlay').classList.add('show');
    } else {
        alert(`功能 [${action}] 正在开发中...`);
    }
}

function closeSendVoiceModal() {
    document.getElementById('sendVoiceModalOverlay').classList.remove('show');
}

function confirmSendVoice() {
    const text = document.getElementById('voiceTextInput').value.trim();
    if (text) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        if (!currentLoginId || !currentChatRoomCharId) return;
        
        let newMsg = { role: 'user', type: 'voice', content: text, timestamp: Date.now() };
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        history.push(newMsg);
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        
        // --- 新增：双向同步给对方 ---
        let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
        let targetMsg = { ...newMsg, role: 'char' };
        targetHistory.push(targetMsg);
        ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

        let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
        targetSessions = targetSessions.filter(id => id !== currentLoginId);
        targetSessions.unshift(currentLoginId);
        ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));

        let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
        ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
        // ---------------------------
        
        renderChatHistory(currentChatRoomCharId);
        closeSendVoiceModal();
    } else {
        alert('请输入语音内容！');
    }
}

function toggleVoiceText(index) {
    const textEl = document.getElementById(`voice-text-${index}`);
    if (textEl) {
        if (textEl.style.display === 'none') {
            textEl.style.display = 'block';
        } else {
            textEl.style.display = 'none';
        }
    }
}

// 优化：先判断是否存在 show 类再移除，减少不必要的 DOM 重绘导致卡顿
function closeChatPanels() {
    const morePanel = document.getElementById('crMorePanel');
    const emojiPanel = document.getElementById('crEmojiPanel');
    let isChanged = false;
    
    if (morePanel && morePanel.classList.contains('show')) { 
        morePanel.classList.remove('show'); 
        isChanged = true;
    }
    if (emojiPanel && emojiPanel.classList.contains('show')) { 
        emojiPanel.classList.remove('show'); 
        isChanged = true;
    }
    
    if (isChanged) {
        document.getElementById('chatRoomHistory').style.transform = 'translateY(0)';
    }
}

// ✅ 修复：使用可选链绑定事件，避免重复声明 const 导致报错
document.getElementById('chatRoomInput')?.addEventListener('focus', () => {
    closeChatPanels(); // 聚焦时只负责关闭表情/更多面板
});

// Roll重回逻辑：以用户最新消息为标准重新生成
function executeRollRedo() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    
    // 从后往前找，找到最后一条 user 发送的消息
    let lastUserIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user') {
            lastUserIndex = i;
            break;
        }
    }

    if (lastUserIndex !== -1) {
        // 截断历史记录，保留到最后一条 user 消息
        history = history.slice(0, lastUserIndex + 1);
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        renderChatHistory(currentChatRoomCharId);
        
        // 触发重新生成
        generateApiReply();
    } else {
        alert('没有找到您发送的最新消息，无法重回！');
    }
}

// --- 发送图片相关逻辑 ---
function closeSendImageModal() {
    document.getElementById('sendImageModalOverlay').classList.remove('show');
}

function openImageDetail(index) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[index];
    if (!msg) return;

    const contentEl = document.getElementById('imageDetailContent');
    contentEl.innerHTML = '';

    if (msg.content.includes('chat-img-120') || (msg.content.trim().startsWith('<img') && msg.content.trim().endsWith('>'))) {
        const match = msg.content.match(/src="([^"]+)"/);
        if (match && match[1]) {
            contentEl.innerHTML = `<img src="${match[1]}">`;
        }
    } else if (msg.content.includes('chat-desc-img-120')) {
        let cleanContent = msg.content.replace(/<div class="img-icon">🖼️<\/div>/g, '');
        const match = cleanContent.match(/<div class="img-text">([\s\S]*?)<\/div>/);
        if (match && match[1]) {
            contentEl.innerHTML = `<div class="image-detail-text-card">${match[1]}</div>`;
        }
    }

    document.getElementById('imageDetailOverlay').classList.add('show');
}

function closeImageDetail() {
    document.getElementById('imageDetailOverlay').classList.remove('show');
}

function triggerLocalImageUpload() {
    closeSendImageModal();
    document.getElementById('chatLocalImageInput').click();
}

function handleSendLocalImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgUrl = e.target.result;
        const content = `<img src="${imgUrl}" class="chat-img-120">`;
        saveAndRenderUserMessage(content);
    }
    reader.readAsDataURL(file);
    event.target.value = ''; // 清空 input
}

// 专门处理直接拍照的逻辑
function handleCameraCapture(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgUrl = e.target.result;
        const content = `<img src="${imgUrl}" class="chat-img-120">`;
        saveAndRenderUserMessage(content);
    }
    reader.readAsDataURL(file);
    event.target.value = ''; // 清空 input
}

function triggerDescImageUpload() {
    closeSendImageModal();
    const desc = prompt('请输入图片画面的文字描述：');
    if (desc && desc.trim() !== '') {
        const content = `<div class="chat-desc-img-120"><div class="img-text">${desc.trim()}</div></div>`;
        saveAndRenderUserMessage(content);
    }
}

function saveAndRenderUserMessage(content) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;
    
    let newMsg = { role: 'user', content: content, timestamp: Date.now() };
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    history.push(newMsg);
    ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
    
    // --- 新增：双向同步给对方 ---
    let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
    let targetMsg = { ...newMsg, role: 'char' };
    targetHistory.push(targetMsg);
    ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

    let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
    targetSessions = targetSessions.filter(id => id !== currentLoginId);
    targetSessions.unshift(currentLoginId);
    ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));

    let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
    ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
    // ---------------------------
    
    renderChatHistory(currentChatRoomCharId);
}

// 渲染聊天室内的表情包面板 (带分组)
function renderChatRoomEmojis() {
    const grid = document.getElementById('chatRoomEmojiGrid');
    const groupContainer = document.getElementById('chatRoomEmojiGroups');
    grid.innerHTML = '';
    groupContainer.innerHTML = '';
    
    let emojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
    let groups = JSON.parse(ChatDB.getItem('chat_emoji_groups') || '["默认分组"]');
    
    // 1. 渲染底部群组切换
    groups.forEach(g => {
        const gBtn = document.createElement('div');
        gBtn.className = `cr-emoji-group-item ${g === chatRoomCurrentEmojiGroup ? 'active' : ''}`;
        gBtn.innerText = g;
        gBtn.onclick = (e) => {
            e.stopPropagation(); // 防止触发关闭面板
            chatRoomCurrentEmojiGroup = g;
            renderChatRoomEmojis();
        };
        groupContainer.appendChild(gBtn);
    });

    // 2. 渲染当前群组的表情包
    let currentEmojis = emojis.filter(e => e.group === chatRoomCurrentEmojiGroup);
    
    if (currentEmojis.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #888; font-size: 12px; padding: 40px 0;">该分组暂无表情包</div>';
        return;
    }

    currentEmojis.forEach(em => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.gap = '4px';
        item.style.cursor = 'pointer';
        item.style.width = '50px';
        item.onclick = (e) => {
            e.stopPropagation(); // 防止触发关闭面板
            sendEmojiMessage(em.url, em.desc);
        };

        item.innerHTML = `
            <div style="width: 50px; height: 50px; background-image: url('${em.url}'); background-size: contain; background-position: center; background-repeat: no-repeat; border-radius: 8px; background-color: transparent;"></div>
            <div style="font-size: 10px; color: #555; width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${em.desc}</div>
        `;
        grid.appendChild(item);
    });
}

function sendEmojiMessage(url, desc) {
    if (!currentChatRoomCharId) return;
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    const content = `<img src="${url}" alt="${desc || '表情包'}" style="width: 100px; height: 100px; object-fit: contain; border-radius: 8px; display: block; margin: 5px 0;">`;
    let newMsg = { role: 'user', content: content, timestamp: Date.now() };
    
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    history.push(newMsg);
    ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
    
    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    sessions = sessions.filter(id => id !== currentChatRoomCharId);
    sessions.unshift(currentChatRoomCharId);
    ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));
    
    // --- 新增：双向同步给对方 ---
    let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
    let targetMsg = { ...newMsg, role: 'char' };
    targetHistory.push(targetMsg);
    ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

    let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
    targetSessions = targetSessions.filter(id => id !== currentLoginId);
    targetSessions.unshift(currentLoginId);
    ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));

    let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
    ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
    // ---------------------------
    
    if (typeof renderChatList === 'function') renderChatList();
    renderChatHistory(currentChatRoomCharId);
    closeChatPanels();
}

// ==========================================
// 聊天室设置与美化逻辑 (背景 & CSS)
// ==========================================
let tempSelectedEmojiGroups = []; // 临时记录弹窗选中的分组

function openChatSettingsPanel() {
    document.getElementById('chatSettingsPanel').style.display = 'flex';
    renderChatBgLibrary();
    renderChatCssPresets();
    
    const currentCss = ChatDB.getItem('chat_current_css') || '';
    document.getElementById('chatCustomCssInput').value = currentCss;

    const currentLoginId = ChatDB.getItem('current_login_account');
    let allEntities = getAllEntities();
    const me = allEntities.find(a => a.id === currentLoginId);
    const char = allEntities.find(c => c.id === currentChatRoomCharId);

    document.getElementById('csUserAvatar').style.backgroundImage = "url('" + (me ? me.avatarUrl : '') + "')";
    document.getElementById('csCharAvatar').style.backgroundImage = "url('" + (char ? char.avatarUrl : '') + "')";

    const charAvatarWrap = document.getElementById('csCharAvatarWrap') || document.getElementById('csCharAvatar').parentElement;
    charAvatarWrap.onclick = () => {
        if (char && char.isAccount) {
            // 核心修复：char 本身就已经包含了账号的所有信息，直接读取 personaId 即可
            if (char.personaId) {
                editPersonaById(char.personaId);
            }
        } else {
            openCharEditPanel(currentChatRoomCharId);
        }
    };

    // 渲染头像间的互动标识：显示当前佩戴的标识，若无则显示默认火花
    const badgeContainer = document.getElementById('csInteractionBadge');
    const wornHtml = getWornBadgeHtml(currentChatRoomCharId);
    
    if (wornHtml) {
        badgeContainer.innerHTML = wornHtml.replace('width:16px; height:16px;', 'width:28px; height:28px;');
    } else {
        const stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}')[currentChatRoomCharId] || { streak: 0 };
        const isFireActive = stats.streak >= 3;
        const fireClass = isFireActive ? (stats.streak >= 30 ? 'badge-fire big' : 'badge-fire') : 'badge-fire dimmed';
        const firePath = stats.streak >= 30 ? SVG_PATHS.BIG_FIRE : SVG_PATHS.FIRE;
        badgeContainer.innerHTML = `<div class="badge-icon ${fireClass}" style="width:28px;height:28px;"><svg viewBox="0 0 24 24"><path d="${firePath}"/></svg></div>`;
    }

    document.getElementById('csCharNameLabel').innerText = char ? (char.netName || char.name) : '未知角色';
    document.getElementById('csUserNameLabel').innerText = me ? me.netName : '我';

    document.getElementById('csContextLimit').value = ChatDB.getItem(`chat_context_limit_${currentChatRoomCharId}`) || '';
    document.getElementById('csMinReply').value = ChatDB.getItem(`chat_min_reply_${currentChatRoomCharId}`) || '';
    document.getElementById('csMaxReply').value = ChatDB.getItem(`chat_max_reply_${currentChatRoomCharId}`) || '';
    document.getElementById('csTimeAwareToggle').checked = ChatDB.getItem(`chat_time_aware_${currentChatRoomCharId}`) === 'true';
    document.getElementById('csInnerVoiceToggle').checked = ChatDB.getItem(`chat_inner_voice_enabled_${currentChatRoomCharId}`) === 'true';
    document.getElementById('csBadgeAwareToggle').checked = ChatDB.getItem(`chat_badge_aware_${currentChatRoomCharId}`) === 'true';
    document.getElementById('csActiveMsgToggle').checked = ChatDB.getItem(`chat_active_msg_${currentChatRoomCharId}`) === 'true';
    document.getElementById('csActiveMsgInterval').value = ChatDB.getItem(`chat_active_msg_interval_${currentChatRoomCharId}`) || '60';

    tempSelectedEmojiGroups = JSON.parse(ChatDB.getItem(`chat_char_emoji_groups_${currentChatRoomCharId}`) || '[]');
    updateEmojiSelectBtnText();
}

function openEmojiSelectModal() {
    const listEl = document.getElementById('emojiSelectModalList');
    listEl.innerHTML = '';
    let emojiGroups = JSON.parse(ChatDB.getItem('chat_emoji_groups') || '["默认分组"]');
    
    emojiGroups.forEach(g => {
        const item = document.createElement('label');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; border-radius: 10px; cursor: pointer;';
        const isChecked = tempSelectedEmojiGroups.includes(g);
        item.innerHTML = `
            <span style="font-size: 14px; color: #333;">${g}</span>
            <input type="checkbox" value="${g}" ${isChecked ? 'checked' : ''} class="modal-emoji-cb" style="width: 18px; height: 18px;">
        `;
        listEl.appendChild(item);
    });
    document.getElementById('emojiSelectModalOverlay').classList.add('show');
}

function confirmEmojiSelect() {
    const cbs = document.querySelectorAll('.modal-emoji-cb:checked');
    tempSelectedEmojiGroups = Array.from(cbs).map(cb => cb.value);
    updateEmojiSelectBtnText();
    document.getElementById('emojiSelectModalOverlay').classList.remove('show');
}

function updateEmojiSelectBtnText() {
    const btn = document.getElementById('csEmojiSelectBtn');
    if (tempSelectedEmojiGroups.length > 0) {
        btn.innerText = `已选 ${tempSelectedEmojiGroups.length} 个分组`;
        btn.style.color = '#111';
    } else {
        btn.innerText = '点击选择...';
        btn.style.color = '#888';
    }
}

function saveChatSettings() {
    const contextLimit = document.getElementById('csContextLimit').value;
    const minReply = document.getElementById('csMinReply').value;
    const maxReply = document.getElementById('csMaxReply').value;
    const timeAware = document.getElementById('csTimeAwareToggle').checked;
    const innerVoiceEnabled = document.getElementById('csInnerVoiceToggle').checked;
    const badgeAware = document.getElementById('csBadgeAwareToggle').checked;
    const activeMsg = document.getElementById('csActiveMsgToggle').checked;
    const activeMsgInterval = document.getElementById('csActiveMsgInterval').value;

    ChatDB.setItem(`chat_context_limit_${currentChatRoomCharId}`, contextLimit);
    ChatDB.setItem(`chat_min_reply_${currentChatRoomCharId}`, minReply);
    ChatDB.setItem(`chat_max_reply_${currentChatRoomCharId}`, maxReply);
    ChatDB.setItem(`chat_time_aware_${currentChatRoomCharId}`, String(timeAware));
    ChatDB.setItem(`chat_inner_voice_enabled_${currentChatRoomCharId}`, String(innerVoiceEnabled));
    ChatDB.setItem(`chat_badge_aware_${currentChatRoomCharId}`, String(badgeAware));
    ChatDB.setItem(`chat_active_msg_${currentChatRoomCharId}`, String(activeMsg));
    ChatDB.setItem(`chat_active_msg_interval_${currentChatRoomCharId}`, activeMsgInterval);
    ChatDB.setItem(`chat_char_emoji_groups_${currentChatRoomCharId}`, JSON.stringify(tempSelectedEmojiGroups));

    alert('设置已保存！');
    closeChatSettingsPanel();
}

function closeChatSettingsPanel() {
    document.getElementById('chatSettingsPanel').style.display = 'none';
}

// --- 聊天背景逻辑 ---
function handleChatBgUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = e.target.result;
            let bgs = JSON.parse(ChatDB.getItem('chat_backgrounds') || '[]');
            bgs.push(imgUrl);
            ChatDB.setItem('chat_backgrounds', JSON.stringify(bgs));
            renderChatBgLibrary();
        }
        reader.readAsDataURL(file);
    }
}

function renderChatBgLibrary() {
    const grid = document.getElementById('chatBgLibraryGrid');
    grid.innerHTML = '';
    let bgs = JSON.parse(ChatDB.getItem('chat_backgrounds') || '[]');
    const currentBg = ChatDB.getItem('chat_current_bg') || '';

    // 默认无背景选项
    const defaultItem = document.createElement('div');
    defaultItem.style.cssText = `aspect-ratio: 9/16; background: #f4f4f4; border-radius: 8px; border: ${currentBg === '' ? '2px solid #111' : '1px solid #eee'}; display: flex; justify-content: center; align-items: center; font-size: 12px; color: #888; cursor: pointer;`;
    defaultItem.innerText = '默认';
    defaultItem.onclick = () => applyChatBg('');
    grid.appendChild(defaultItem);

    bgs.forEach((bg, index) => {
        const item = document.createElement('div');
        item.style.cssText = `aspect-ratio: 9/16; background-image: url('${bg}'); background-size: cover; background-position: center; border-radius: 8px; border: ${currentBg === bg ? '2px solid #111' : '1px solid #eee'}; cursor: pointer; position: relative;`;
        item.onclick = () => applyChatBg(bg);
        
        const delBtn = document.createElement('div');
        delBtn.innerHTML = '×';
        delBtn.style.cssText = 'position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; background: #ff3b30; color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChatBg(index);
        };
        item.appendChild(delBtn);
        grid.appendChild(item);
    });
}

function applyChatBg(bgUrl) {
    ChatDB.setItem('chat_current_bg', bgUrl);
    renderChatBgLibrary();
    updateChatRoomAppearance();
}

function deleteChatBg(index) {
    if (confirm('确定删除此背景吗？')) {
        let bgs = JSON.parse(ChatDB.getItem('chat_backgrounds') || '[]');
        const deletingBg = bgs[index];
        bgs.splice(index, 1);
        ChatDB.setItem('chat_backgrounds', JSON.stringify(bgs));
        
        if (ChatDB.getItem('chat_current_bg') === deletingBg) {
            applyChatBg(''); // 如果删除的是当前背景，恢复默认
        } else {
            renderChatBgLibrary();
        }
    }
}

// --- 自定义 CSS 逻辑 ---
function applyChatCustomCss() {
    const css = document.getElementById('chatCustomCssInput').value;
    ChatDB.setItem('chat_current_css', css);
    updateChatRoomAppearance();
    alert('CSS 已应用！');
}

function saveChatCssPreset() {
    const css = document.getElementById('chatCustomCssInput').value.trim();
    if (!css) return alert('CSS 内容为空！');
    openGlobalPrompt('保存预设', '请输入预设名称', '⸝⸝⸝ ╸▵╺⸝⸝⸝', (name) => {
        if (name && name.trim()) {
            let presets = JSON.parse(ChatDB.getItem('chat_css_presets') || '[]');
            presets.push({ id: Date.now().toString(), name: name.trim(), css: css });
            ChatDB.setItem('chat_css_presets', JSON.stringify(presets));
            renderChatCssPresets();
        }
    });
}

function renderChatCssPresets() {
    const list = document.getElementById('modalCssPresetList');
    if (!list) return;
    list.innerHTML = '';
    let presets = JSON.parse(ChatDB.getItem('chat_css_presets') || '[]');
    
    if (presets.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 12px; padding: 10px 0;">暂无预设</div>';
        return;
    }

    presets.forEach(p => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; padding: 10px 15px; border-radius: 12px; border: 1px solid #eee;';
        item.innerHTML = `
            <span style="font-size: 14px; color: #333; font-weight: bold; cursor: pointer; flex: 1;" onclick="loadChatCssPreset('${p.id}')">${p.name}</span>
            <span style="color: #ff3b30; font-size: 18px; font-weight: bold; cursor: pointer; padding: 0 5px;" onclick="deleteChatCssPreset('${p.id}')">×</span>
        `;
        list.appendChild(item);
    });
}

function openCssPresetModal() {
    renderChatCssPresets();
    document.getElementById('cssPresetModalOverlay').classList.add('show');
}

function closeCssPresetModal() {
    document.getElementById('cssPresetModalOverlay').classList.remove('show');
}

function loadChatCssPreset(id) {
    let presets = JSON.parse(ChatDB.getItem('chat_css_presets') || '[]');
    const preset = presets.find(p => p.id === id);
    if (preset) {
        document.getElementById('chatCustomCssInput').value = preset.css;
        applyChatCustomCss();
        closeCssPresetModal(); // 加载后自动关闭弹窗
    }
}

function deleteChatCssPreset(id) {
    if (confirm('确定删除此 CSS 预设吗？')) {
        let presets = JSON.parse(ChatDB.getItem('chat_css_presets') || '[]');
        presets = presets.filter(p => p.id !== id);
        ChatDB.setItem('chat_css_presets', JSON.stringify(presets));
        renderChatCssPresets(); // 删除后刷新弹窗内的列表
    }
}

// --- 统一更新聊天室外观 ---
function updateChatRoomAppearance() {
    // 1. 更新背景
    const bgUrl = ChatDB.getItem('chat_current_bg') || '';
    const historyEl = document.getElementById('chatRoomHistory');
    if (historyEl) {
        if (bgUrl) {
            historyEl.style.backgroundImage = "url('" + bgUrl + "')";
            historyEl.style.backgroundSize = 'cover';
            historyEl.style.backgroundPosition = 'center';
            // 【性能优化】：移除 backgroundAttachment = 'fixed'，改为 scroll 防止移动端重绘卡顿
            historyEl.style.backgroundAttachment = 'scroll'; 
        } else {
            historyEl.style.backgroundImage = 'none';
            historyEl.style.backgroundColor = 'transparent';
        }
    }

    // 2. 更新 CSS (利用 CSS Nesting 防止全局污染)
    const rawCss = ChatDB.getItem('chat_current_css') || '';
    let styleTag = document.getElementById('customChatCssTag');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'customChatCssTag';
        document.head.appendChild(styleTag);
    }
    
    const newCss = rawCss.trim() !== '' ? `
        #chatRoomPanel, .cs-css-preview-box {
            ${rawCss}
        }
    ` : '';
    
    // 【性能优化】：只有当 CSS 真正发生变化时才重新赋值，避免每次打开聊天室都触发全局重绘
    if (styleTag.innerHTML !== newCss) {
        styleTag.innerHTML = newCss;
    }
}

// 页面加载时初始化外观 (等待数据库就绪)
window.addEventListener('ChatDBReady', () => {
    updateChatRoomAppearance();
});
// ==========================================
// 终极整合版 API 联机回复逻辑 (JSON协议 + 正则过滤 + 深度设定)
// ==========================================

// --- 心声动画与控制逻辑 ---
function closeInnerVoicePanel() {
    document.getElementById('innerVoiceOverlay').classList.remove('show');
}

function playInnerVoiceAnimation(text) {
    const overlay = document.getElementById('innerVoiceOverlay');
    const typedEl = document.getElementById('ivTypedContent');
    const fullHint = document.getElementById('ivFullHint');
    const keys = document.querySelectorAll('.ios-keyboard-mini .kb-key:not(.special):not(.space):not(.send)');
    
    fullHint.innerText = `"${text}"`;
    typedEl.innerText = '';
    overlay.classList.add('show');
    
    let i = 0;
    function type() {
        if (!overlay.classList.contains('show')) return; // 如果中途被关闭，直接结束
        if (i < text.length) {
            typedEl.innerText += text.charAt(i);
            i++;
            // 随机按键高亮模拟打字
            if (keys.length > 0) {
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                randomKey.classList.add('active-press');
                setTimeout(() => randomKey.classList.remove('active-press'), 50);
            }
            setTimeout(type, 50 + Math.random() * 50);
        }
    }
    type();
}

let isGeneratingApiReply = false; // 新增：全局防误触锁

async function generateApiReply(isProactive = false, proactiveCharId = null) {
    if (isGeneratingApiReply) return; // 如果正在生成，直接拦截
    isGeneratingApiReply = true;

    const currentLoginId = ChatDB.getItem('current_login_account');
    const targetCharId = isProactive ? proactiveCharId : currentChatRoomCharId;
    if (!currentLoginId || !targetCharId) {
        isGeneratingApiReply = false;
        return;
    }

    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) {
        if (!isProactive) alert('请先在设置中配置 API 信息！');
        return;
    }

    // 1. 获取基础设定与限制
    const contextLimit = parseInt(ChatDB.getItem(`chat_context_limit_${targetCharId}`)) || 0;
    const minReply = parseInt(ChatDB.getItem(`chat_min_reply_${targetCharId}`)) || 0;
    const maxReply = parseInt(ChatDB.getItem(`chat_max_reply_${targetCharId}`)) || 0;
    const timeAware = ChatDB.getItem(`chat_time_aware_${targetCharId}`) === 'true';
    const innerVoiceEnabled = ChatDB.getItem(`chat_inner_voice_enabled_${targetCharId}`) === 'true';
    const badgeAware = ChatDB.getItem(`chat_badge_aware_${targetCharId}`) === 'true';
    const boundEmojiGroups = JSON.parse(ChatDB.getItem(`chat_char_emoji_groups_${targetCharId}`) || '[]');

    let chars = getAllEntities();
    const char = chars.find(c => c.id === targetCharId);
    if (!char) return;
    
    // 如果对方是真实用户账号，拦截 AI 回复
    if (char.isAccount) {
        isGeneratingApiReply = false;
        if (!isProactive) alert('对方是真实用户账号，无法使用 AI 自动回复。');
        return;
    }

    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));

    const charName = char.name || 'Char';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取历史记录并进行世界书扫描
    let fullHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
    let recentHistory = contextLimit > 0 ? fullHistory.slice(-contextLimit) : fullHistory.slice(-40);
    const recentTextForWb = recentHistory.slice(-5).map(m => m.content).join('\n');

    let activeWbs = { top: [], before: [], after: [], bottom: [] };
    if (char.wbEntries && char.wbEntries.length > 0) {
        let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
        let entries = wbData.entries.filter(e => char.wbEntries.includes(e.id));
        entries.forEach(entry => {
            let isActivated = entry.constant || false;
            if (!isActivated && entry.keywords) {
                let keys = entry.keywords.split(',').map(k => k.trim()).filter(k => k);
                for (let key of keys) {
                    let regex = new RegExp(key, 'i');
                    if (regex.test(recentTextForWb)) { isActivated = true; break; }
                }
            }
            if (isActivated) {
                let pos = entry.position || 'before';
                if (activeWbs[pos]) activeWbs[pos].push(entry.content);
            }
        });
    }

    // 3. 构建表情包映射
    let charEmojiMap = {}; 
    let charEmojis = [];
    if (boundEmojiGroups.length > 0) {
        let allEmojis = JSON.parse(ChatDB.getItem('chat_emojis') || '[]');
        charEmojis = allEmojis.filter(e => boundEmojiGroups.includes(e.group));
        charEmojis.forEach(e => { charEmojiMap[e.desc] = e.url; });
    }

    // 4. 构建 System Prompt (要求返回 JSON 包含 inner_voice)
    const pad = (n) => n.toString().padStart(2, '0');
    const now = new Date();
    const currentTimeStr = `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    let systemPrompt = `你正在一个名为“微信”的线上聊天软件中扮演一个角色。请严格遵守以下规则：\n`;
    systemPrompt += `【核心规则】\n`;
    if (timeAware) {
        systemPrompt += `A. 当前时间：现在是 ${currentTimeStr}。你应知晓时间流逝，但除非对话相关，否则不要主动提及。\n`;
        
        // 【新增】：计算用户回复/主动找你的时间间隔
        if (!isProactive && fullHistory.length >= 2) {
            const currentMsg = fullHistory[fullHistory.length - 1];
            const prevMsg = fullHistory[fullHistory.length - 2];
            const timeGapMs = currentMsg.timestamp - prevMsg.timestamp;
            const gapMinutes = Math.floor(timeGapMs / 60000);
            
            if (gapMinutes >= 20) { // 超过20分钟算作有间隔
                const gapHours = Math.floor(gapMinutes / 60);
                const gapDays = Math.floor(gapHours / 24);
                let timeGapStr = gapDays > 0 ? `${gapDays}天${gapHours % 24}小时` : (gapHours > 0 ? `${gapHours}小时${gapMinutes % 60}分钟` : `${gapMinutes}分钟`);
                
                if (prevMsg.role === 'char') {
                    systemPrompt += `   - [时间感知情报]：距离你上一条消息，${userName} 隔了 ${timeGapStr} 才回复你。话题可能已中断，你可以根据人设做出反应。\n`;
                } else {
                    systemPrompt += `   - [时间感知情报]：距离上次聊天，${userName} 隔了 ${timeGapStr} 再次主动找你。话题可能已中断，你可以根据人设做出反应。\n`;
                }
            }
        }
    } else {
        systemPrompt += `A. 时间感知：你没有时间观念，不知道现在几点。\n`;
    }
    systemPrompt += `B. 纯线上互动：这是一个完全虚拟的线上聊天。严禁提出线下见面或索要现实联系方式。你必须始终保持在线身份。\n\n`;

    if (activeWbs.top.length > 0) systemPrompt += `[背景设定]\n${activeWbs.top.join('\n')}\n\n`;
    
    // 【新增：酒馆风格记忆注入】(改为绑定面具ID，实现同面具小号记忆互通)
    const currentPersonaId = persona ? persona.id : currentLoginId;
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${currentPersonaId}_${targetCharId}`) || '{}');
    
    // 1. 注入对话总结 (Chat Summary) - 放在背景设定的最前面
    if (memory.summary && memory.summary.length > 0) {
        systemPrompt += `[前情提要/故事总结]\n${memory.summary[0].content}\n\n`;
    }
    
    // 2. 注入核心记忆 (Core)
    if (memory.core && memory.core.length > 0) {
        systemPrompt += `[核心记忆]\n${memory.core.map(m => m.content).join('\n')}\n\n`;
    }

    systemPrompt += `【角色与对话规则】\n`;
    if (activeWbs.before.length > 0) systemPrompt += `${activeWbs.before.join('\n')}\n`;
    
    systemPrompt += `<char_settings>\n`;
    systemPrompt += `1. 你的名字：${charName}。我的称呼：${userName}。\n`;
    systemPrompt += `2. 你的设定：${char.description || "一个真实的聊天伙伴。"}\n`;
    if (char.scenario) systemPrompt += `3. 当前场景：${char.scenario}\n`;
    if (activeWbs.after.length > 0) systemPrompt += `${activeWbs.after.join('\n')}\n`;
    systemPrompt += `</char_settings>\n\n`;

    systemPrompt += `<user_settings>\n关于我的人设：${(persona && persona.persona) ? persona.persona : "普通用户"}\n</user_settings>\n`;
    
    // 互动标识感知
    if (badgeAware) {
        const stats = JSON.parse(ChatDB.getItem(`interaction_stats_${currentLoginId}`) || '{}')[targetCharId] || {};
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const isExtinguished = stats.lastDate && (stats.lastDate !== today && stats.lastDate !== yesterday);

        systemPrompt += `\n【互动标识状态】\n`;
        systemPrompt += `你和 ${userName} 当前的互动状态：\n`;
        let hasBadge = false;
        if (stats.streak >= 3 && !isExtinguished) {
            systemPrompt += `- 畅聊火花：你们已经连续聊天 ${stats.streak} 天了，关系非常火热。\n`;
            hasBadge = true;
        }
        if (isExtinguished && stats.streak >= 3) {
            systemPrompt += `- 标识熄灭：你们之前连续聊天了 ${stats.streak} 天，但因为昨天没有聊天，"畅聊火花"标识已经熄灭/消失了。你可以对此表达惋惜或傲娇的抱怨。\n`;
            hasBadge = true;
        }
        if (stats.littleLuck && !isExtinguished) {
            systemPrompt += `- 小幸运：你们是今天刚加的好友并且聊得很开心。\n`;
            hasBadge = true;
        }
        if (stats.count >= 100) {
            systemPrompt += `- 闲聊水花：你们累计已经发了超过 100 条消息。\n`;
            hasBadge = true;
        }
        // 【新增】：共鸣唱片感知
        if (stats.musicStreak >= 3) {
            systemPrompt += `- 共鸣唱片：你们已经连续一起听歌 ${stats.musicStreak} 天了，音乐品味产生了强烈的共鸣。\n`;
            hasBadge = true;
        }
        if (!hasBadge) {
            systemPrompt += `- 目前暂无特殊的互动标识。\n`;
        }
    }

    // 【深度整合】：关联账号与 Char 自身未读消息的终极情报注入
    const isLinkedEnabled = ChatDB.getItem(`linked_account_enabled_${currentLoginId}`) !== 'false';
    let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
    let allEntities = getAllEntities();
    
    let otherLinkedMsgContext = ""; // User 其他小号收到的消息
    let charUnreadContext = "";     // Char 自己收到的消息
    
    // 1. 收集 User 关联账号（小号）的消息
    if (isLinkedEnabled && linkedAccounts.length > 0) {
        linkedAccounts.forEach(accId => {
            if (accId === targetCharId) return; // 排除 Char 自己，下面单独处理
            const accEntity = allEntities.find(e => e.id === accId);
            if (!accEntity) return;
            
            let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${accId}`) || '[]');
            sessions.forEach(targetId => {
                let unread = parseInt(ChatDB.getItem(`unread_${accId}_${targetId}`) || '0');
                if (unread > 0) {
                    let history = JSON.parse(ChatDB.getItem(`chat_history_${accId}_${targetId}`) || '[]');
                    if (history.length > 0) {
                        let lastMsg = history[history.length - 1];
                        let safeContent = lastMsg.content || '';
                        let contentText = safeContent.replace(/<[^>]+>/g, '');
                        if (lastMsg.type === 'image' || safeContent.includes('<img')) contentText = '[图片]';
                        else if (lastMsg.type === 'voice') contentText = '[语音]';
                        else if (lastMsg.type === 'forward_record') contentText = '[聊天记录]';
                        
                        const targetEntity = allEntities.find(e => e.id === targetId);
                        const targetName = targetEntity ? (targetEntity.netName || targetEntity.name) : '未知';
                        const accName = accEntity.netName || accEntity.name;
                        
                        otherLinkedMsgContext += `- ${userName} 的小号/关联账号【${accName}】收到了来自【${targetName}】的未读消息："${contentText}"\n`;
                    }
                }
            });
        });
    }

    // 2. 收集 Char 自己的未读消息
    let charSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${targetCharId}`) || '[]');
    charSessions.forEach(senderId => {
        if (senderId === currentLoginId) return; // 排除当前正在聊天的 User 大号
        let unread = parseInt(ChatDB.getItem(`unread_${targetCharId}_${senderId}`) || '0');
        if (unread > 0) {
            let history = JSON.parse(ChatDB.getItem(`chat_history_${targetCharId}_${senderId}`) || '[]');
            if (history.length > 0) {
                let lastMsg = history[history.length - 1];
                let contentText = lastMsg.content.replace(/<[^>]+>/g, '');
                if (lastMsg.type === 'image' || lastMsg.content.includes('<img')) contentText = '[图片]';
                else if (lastMsg.type === 'voice') contentText = '[语音]';
                
                const senderEntity = allEntities.find(e => e.id === senderId);
                const senderName = senderEntity ? (senderEntity.netName || senderEntity.name) : '未知';
                
                charUnreadContext += `- 【${senderName}】(ID: ${senderId}) 给你发了 ${unread} 条未读消息，最新一条是："${contentText}"\n`;
            }
        }
    });

    // 3. 组合 Prompt
    if (otherLinkedMsgContext || charUnreadContext) {
        systemPrompt += `\n【系统机密情报：消息监控与感知】\n`;
        
        if (charUnreadContext) {
            systemPrompt += `你收到了其他人的未读消息：\n${charUnreadContext}`;
            // 核心修罗场逻辑：判断 User 是否关联了 Char
            if (linkedAccounts.includes(targetCharId)) {
                systemPrompt += `【高能警告】：${userName} 已经通过「关联账号」功能绑定了你！TA 的手机上能实时看到你收到的这些消息！\n`;
            }
            systemPrompt += `如果你想查看（已读）某个人的消息，请在 JSON 根节点添加字段 "read_messages": ["对方的ID"]。查看后未读红点会消失。\n`;
        }
        
        if (otherLinkedMsgContext) {
            systemPrompt += `你感知到 ${userName} 的其他关联账号目前收到了以下未读消息：\n${otherLinkedMsgContext}`;
            systemPrompt += `(你可以根据你的人设，在聊天中自然地提及这些事，比如提醒 ${userName} 去回消息，或者表现出吃醋、八卦、好奇等反应。)\n`;
        }
    }

    if (activeWbs.bottom.length > 0) systemPrompt += `\n[补充信息]\n${activeWbs.bottom.join('\n')}\n`;

    // 3. 注入作者备注 (Author's Note) - 放在最靠近底部的地方，权重最高
    if (memory.note && memory.note.length > 0) {
        systemPrompt += `\n[System Note: ${memory.note.map(m => m.content).join(' ')}]\n`;
    }

    // 主动发消息的 Prompt 注入
    if (isProactive) {
        const lastMsg = fullHistory[fullHistory.length - 1];
        const timeGapMs = lastMsg ? (Date.now() - lastMsg.timestamp) : 0;
        const gapMinutes = Math.floor(timeGapMs / 60000);
        const gapHours = Math.floor(gapMinutes / 60);
        const gapDays = Math.floor(gapHours / 24);
        let timeGapStr = gapDays > 0 ? `${gapDays}天` : (gapHours > 0 ? `${gapHours}小时` : `${gapMinutes}分钟`);

        if (timeAware) {
            systemPrompt += `\n[系统通知：距离上次互动已过去 ${timeGapStr}。话题可能已中断。
请以 ${char.name} 的身份主动发起新话题，或自然地延续之前的对话，对时间流逝做出反应。
【行动前请在内部逻辑中进行深度考量】：
1. 现实感知：当前现实时间是 ${currentTimeStr}。结合你的人设，你现在应该在做什么？
2. 动机分析：你为什么会突然给 User 发消息？
3. 绝对防 OOC：语气必须 100% 符合人设，像真人一样自然切入，拒绝AI味。
考量完毕后，直接输出符合你人设的 JSON 消息数组！]\n`;
        } else {
            systemPrompt += `\n[系统通知：话题可能已中断。
请以 ${char.name} 的身份主动发起新话题，或自然地延续之前的对话。
【行动前请在内部逻辑中进行深度考量】：
1. 动机分析：你为什么会突然给 User 发消息？
2. 绝对防 OOC：语气必须 100% 符合人设，像真人一样自然切入，拒绝AI味。
考量完毕后，直接输出符合你人设的 JSON 消息数组！]\n`;
        }
    }

    // 强制 JSON 输出格式
    systemPrompt += `\n【输出格式严格要求】\n`;
    systemPrompt += `你必须且只能输出一个合法的 JSON 对象。\n`;
    
    if (innerVoiceEnabled) {
        let ivHistory = JSON.parse(ChatDB.getItem(`inner_voice_history_${currentLoginId}_${targetCharId}`) || '[]');
        let lastIv = ivHistory.length > 0 ? ivHistory[ivHistory.length - 1].content : "无";
        
        systemPrompt += `【心声系统已开启】\n`;
        systemPrompt += `上一轮你的心声是：${lastIv}\n`;
        systemPrompt += `请结合上一轮心声和当前对话，输出你此刻的心声。\n`;
        systemPrompt += `格式如下：\n`;
        systemPrompt += `{\n`;
        systemPrompt += `  "inner_voice": "角色此刻内心真实的、未说出口的想法或吐槽",\n`;
        systemPrompt += `  "messages": [\n`;
        systemPrompt += `    {"type":"text", "quote":"引用的对方的话(可选)", "content":"完整的一句话。"}\n`;
        systemPrompt += `  ]\n`;
        systemPrompt += `}\n`;
    } else {
        systemPrompt += `格式如下：\n`;
        systemPrompt += `{\n`;
        systemPrompt += `  "messages": [\n`;
        systemPrompt += `    {"type":"text", "quote":"引用的对方的话(可选)", "content":"完整的一句话。"}\n`;
        systemPrompt += `  ]\n`;
        systemPrompt += `}\n`;
    }
    systemPrompt += `图片消息格式: {"type":"image", "content":"图片画面的详细文字描述"}\n`; 
    systemPrompt += `转账消息格式: {"type":"transfer", "amount":"转账金额(纯数字)", "note":"转账说明"}\n`; 
    systemPrompt += `处理收款格式: {"type":"transfer_action", "action":"received" 或 "rejected", "content":"收款/拒收时的回复"}\n`; 
    systemPrompt += `撤回你自己的上一条消息: {"type":"recall", "content":"撤回后你想补发的话(可选)"}\n`; 
    if (charEmojis.length > 0) {
        systemPrompt += `表情包格式: {"type":"sticker", "content":"表情包描述名称"}\n`;
        systemPrompt += `可用的表情包描述有：${charEmojis.map(e => e.desc).join(', ')}。请自然地穿插在对话中，不要滥用。\n`;
    }
    systemPrompt += `- 必须使用双引号 " 包裹键名和字符串值。\n`;
    systemPrompt += `- 严禁输出损坏的 JSON，严禁在 JSON 外部输出任何多余的字符（如 markdown 标记 \`\`\`json 等）。\n`;
    systemPrompt += `- 模拟真人打字聊天习惯/线上聊天的碎片化习惯，保持对话口语化、碎片化，保持回复气泡的随机性和多样性！\n`;

    if (minReply > 0 || maxReply > 0) {
        systemPrompt += `- 你的回复必须拆分为 ${minReply || 1} 到 ${maxReply || 10} 个独立的气泡（即 messages 数组中的对象数量）。保持数量随机。\n`;
    }

    // 5. 构建消息数组 (修复上下文截断与连续消息合并)
    let messages = [{ role: 'system', content: systemPrompt }];
    let mergedHistory = [];
    
    recentHistory.forEach(msg => {
        let content = msg.content || "";
        let isUser = msg.role === 'user';
        let senderName = isUser ? userName : charName;

        if (msg.type === 'forward_record') {
            const recordText = msg.forwardData.map(d => `${d.name}: ${d.content}`).join('\n');
            content = `*${senderName} 转发了一段聊天记录*:\n${recordText}`;
        } else if (content.includes('chat-desc-img-120')) {
            // 核心修复：识别文字描述的图片，并翻译给大模型
            const match = content.match(/<div class="img-text">([\s\S]*?)<\/div>/);
            const desc = match ? match[1] : "未知图片";
            content = `*${senderName} 发送了一张图片，画面是：[${desc}]*`;
        } else if (content.includes('<img')) {
            if (content.includes('chat-img-120')) {
                // 真实图片：提取 Base64 并转换为大模型 Vision 格式
                const match = content.match(/src="([^"]+)"/);
                if (match && match[1]) {
                    content = [
                        { type: "text", text: `*${senderName} 发送了一张真实图片*` },
                        { type: "image_url", image_url: { url: match[1] } }
                    ];
                } else {
                    content = `*${senderName} 发送了一张真实图片*`;
                }
            } else {
                // 表情包：提取 alt 属性中的描述
                const altMatch = content.match(/alt="([^"]+)"/);
                const desc = altMatch ? altMatch[1] : "未知表情";
                content = `*${senderName} 发送了一个表情包：[${desc}]*`;
            }
        } else if (msg.type === 'voice') {
            content = `*${senderName} 发送了一条语音*:\n${msg.content}`;
        } else if (msg.type === 'transfer') {
            if (isUser) {
                if (msg.status === 'pending') content = `*${userName} 向你转账 ¥${msg.amount}，备注：${msg.note} (等待你收款/退还)*`;
                else if (msg.status === 'received') content = `*${userName} 向你转账 ¥${msg.amount} (你已收款)*`;
                else content = `*${userName} 向你转账 ¥${msg.amount} (你已退还)*`;
            } else {
                content = `*你向 ${userName} 转账 ¥${msg.amount}*`;
            }
        } else if (msg.type === 'family_card') {
            if (msg.subType === 'gift') content = `*${senderName} 赠送了一张亲属卡*`;
            else content = `*${senderName} 索要亲属卡*`;
        } else if (msg.type === 'hidden_system') {
            content = msg.content;
        } else {
            // 清理可能存在的 HTML 标签，防止干扰模型 JSON 输出
            content = content.replace(/<[^>]+>/g, '');
        }

        let role = isUser ? 'user' : 'assistant';
        
        // 核心修复：合并连续的同角色消息，并兼容多模态数组格式
        if (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === role) {
            let prevContent = mergedHistory[mergedHistory.length - 1].content;
            if (Array.isArray(content)) {
                if (!Array.isArray(prevContent)) {
                    mergedHistory[mergedHistory.length - 1].content = [{ type: "text", text: prevContent }];
                }
                mergedHistory[mergedHistory.length - 1].content = mergedHistory[mergedHistory.length - 1].content.concat(content);
            } else {
                if (Array.isArray(prevContent)) {
                    mergedHistory[mergedHistory.length - 1].content.push({ type: "text", text: `\n${content}` });
                } else {
                    mergedHistory[mergedHistory.length - 1].content += `\n${content}`;
                }
            }
        } else {
            mergedHistory.push({ role: role, content: content });
        }
    });

    messages = messages.concat(mergedHistory);

    // 6. 发送请求
    const apiBtn = document.querySelector('.cr-api-btn');
    const originalBtnHtml = apiBtn.innerHTML;
    apiBtn.innerHTML = '<div class="api-loading-spinner" style="width: 14px; height: 14px; border-color: rgba(255,255,255,0.3); border-top-color: #fff;"></div>';
    apiBtn.style.pointerEvents = 'none';

    const titleEl = document.getElementById('chatRoomTitle');
    const originalTitle = titleEl.innerText;
    titleEl.innerHTML = `<div class="api-loading-spinner" style="display:inline-block; width:12px; height:12px; margin-right:6px; border-color:rgba(0,0,0,0.1); border-top-color:#888; vertical-align:middle;"></div> Entering...`;

    try {
        const temp = parseFloat(apiConfig.temperature);
        const finalTemp = isNaN(temp) ? 0.8 : temp;

        const response = await fetch(`${apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({ model: apiConfig.model, messages: messages, temperature: finalTemp })
        });

        if (response.ok) {
            const data = await response.json();
            let replyRaw = data.choices[0].message.content.trim();
            replyRaw = replyRaw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();

            let parsedData = {};
            let messagesArray = [];
            let innerVoice = "";

            try {
                const jsonMatch = replyRaw.match(/\{[\s\S]*\}/s);
                const jsonStr = jsonMatch ? jsonMatch[0] : replyRaw;
                parsedData = JSON.parse(jsonStr);
                
                // 【新增】：处理 char 自主已读消息
                if (parsedData.read_messages && Array.isArray(parsedData.read_messages)) {
                    parsedData.read_messages.forEach(senderId => {
                        ChatDB.setItem(`unread_${targetCharId}_${senderId}`, '0');
                    });
                    // 刷新关联账号列表和聊天列表，消除红点
                    if (typeof renderLinkedAccounts === 'function') renderLinkedAccounts();
                    if (typeof renderChatList === 'function') renderChatList();
                }
                
                innerVoice = parsedData.inner_voice || "";
                messagesArray = parsedData.messages || [];
                
                if (!Array.isArray(messagesArray)) {
                    messagesArray = [messagesArray]; 
                }
            } catch (e) {
                console.warn("JSON解析失败，启动兜底方案");
                messagesArray = replyRaw.split('\n')
                                        .filter(line => line.trim() !== "" && !line.includes('inner_voice') && !line.includes('messages'))
                                        .map(line => ({ type: 'text', content: line.trim() }));
            }

            // 7. 核心逻辑：只把心声存起来，绝对不自动弹出！
            if (innerVoiceEnabled && innerVoice) {
                ChatDB.setItem(`last_inner_voice_${targetCharId}`, innerVoice);
                let ivHistory = JSON.parse(ChatDB.getItem(`inner_voice_history_${currentLoginId}_${targetCharId}`) || '[]');
                ivHistory.push({
                    id: Date.now().toString(),
                    content: innerVoice,
                    timestamp: Date.now()
                });
                ChatDB.setItem(`inner_voice_history_${currentLoginId}_${targetCharId}`, JSON.stringify(ivHistory));
            }

            // 8. 模拟真人打字，一条一条渲染回复气泡
            for (let i = 0; i < messagesArray.length; i++) {
                let msgObj = messagesArray[i];
                let newMsg = { role: 'char', timestamp: Date.now() };

                if (msgObj.type === 'recall') {
                    // Char 主动撤回自己的上一条消息
                    let updatedHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
                    for (let j = updatedHistory.length - 1; j >= 0; j--) {
                        if (updatedHistory[j].role === 'char' && updatedHistory[j].type !== 'system' && updatedHistory[j].type !== 'hidden_system') {
                            updatedHistory[j].originalContent = updatedHistory[j].content;
                            updatedHistory[j].type = 'system';
                            updatedHistory[j].content = '对方撤回了一条消息';
                            break;
                        }
                    }
                    ChatDB.setItem(`chat_history_${currentLoginId}_${targetCharId}`, JSON.stringify(updatedHistory));
                    renderChatHistory(targetCharId);
                    
                    // 如果有补发的话，继续走下面的流程发出来
                    if (msgObj.content) {
                        newMsg.content = msgObj.content;
                    } else {
                        continue;
                    }
                } else if (msgObj.type === 'sticker') {
                    const url = charEmojiMap[msgObj.content];
                    if (url) {
                        newMsg.content = `<img src="${url}" style="width: 100px; height: 100px; object-fit: contain; border-radius: 8px; display: block; margin: 5px 0;">`;
                    } else {
                        continue; 
                    }
                } else if (msgObj.type === 'image') {
                    newMsg.content = `<div class="chat-desc-img-120"><div class="img-text">${msgObj.content}</div></div>`;
                } else if (msgObj.type === 'transfer') {
                    newMsg.type = 'transfer';
                    newMsg.amount = msgObj.amount || '0.00';
                    newMsg.note = msgObj.note || '转账';
                    newMsg.status = 'pending';
                    newMsg.content = '[转账]';
                } else if (msgObj.type === 'transfer_action') {
                    let updatedHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
                    for (let j = updatedHistory.length - 1; j >= 0; j--) {
                        if (updatedHistory[j].role === 'user' && updatedHistory[j].type === 'transfer' && updatedHistory[j].status === 'pending') {
                            updatedHistory[j].status = (msgObj.action === 'rejected') ? 'rejected' : 'received';
                            if (msgObj.action === 'rejected') {
                                let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
                                const char = chars.find(c => c.id === currentChatRoomCharId);
                                const charName = char ? (char.netName || char.name) : '对方';
                                addWalletRecord(currentLoginId, 'refund', `转账退还 - ${charName}`, updatedHistory[j].amount);
                            }
                            break;
                        }
                    }
                    ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(updatedHistory));
                    renderChatHistory(currentChatRoomCharId); 

                    if (msgObj.content) {
                        newMsg.content = msgObj.content;
                    } else {
                        continue; 
                    }
                } else {
                    newMsg.content = msgObj.content;
                    if (!newMsg.content) continue; 
                }

                newMsg.quote = msgObj.quote || '';

                let updatedHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
                updatedHistory.push(newMsg);
                ChatDB.setItem(`chat_history_${currentLoginId}_${targetCharId}`, JSON.stringify(updatedHistory));
                
                // 新增：更新互动数据 (AI回复)
                updateInteractionStats(targetCharId, false);
                
                // 如果当前正在该聊天室，则直接渲染；否则弹出通知、增加未读并刷新列表
                const chatRoomPanel = document.getElementById('chatRoomPanel');
                const isChatRoomVisible = chatRoomPanel && window.getComputedStyle(chatRoomPanel).display !== 'none';
                
                if (targetCharId === currentChatRoomCharId && isChatRoomVisible) {
                    renderChatHistory(currentChatRoomCharId);
                } else {
                    // 增加未读数
                    let unreadCount = parseInt(ChatDB.getItem(`unread_${currentLoginId}_${targetCharId}`) || '0');
                    ChatDB.setItem(`unread_${currentLoginId}_${targetCharId}`, (unreadCount + 1).toString());
                    
                    showMsgNotification(targetCharId, newMsg.content);
                    if (typeof renderChatList === 'function') renderChatList();
                }
                
                // 同步刷新音乐APP的聊天室
                const musicChatPanel = document.getElementById('musicChatPanel');
                if (musicChatPanel && window.getComputedStyle(musicChatPanel).display !== 'none' && targetCharId === window.currentListenTogetherCharId) {
                    if (typeof renderMusicChatHistory === 'function') renderMusicChatHistory();
                }

                if (i < messagesArray.length - 1) {
                    if (targetCharId === currentChatRoomCharId && isChatRoomVisible) {
                        // 如果当前正停留在该角色的聊天室，直接渲染气泡，不弹窗、不加未读
                        renderChatHistory(currentChatRoomCharId);
                    } else {
                        // 如果不在聊天室，才增加未读并弹窗
                        let unreadCount = parseInt(ChatDB.getItem(`unread_${currentLoginId}_${targetCharId}`) || '0');
                        ChatDB.setItem(`unread_${currentLoginId}_${targetCharId}`, (unreadCount + 1).toString());
                        
                        showMsgNotification(targetCharId, newMsg.content);
                        if (typeof renderChatList === 'function') renderChatList();
                    }
                }

                if (i < messagesArray.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

        } else {
            const err = await response.json();
            showApiErrorModal(JSON.stringify(err, null, 2));
        }
    } catch (e) {
        showApiErrorModal(e.message || '网络请求失败，请检查 API 地址或网络连接。');
    } finally {
        isGeneratingApiReply = false; // 释放锁
        apiBtn.innerHTML = originalBtnHtml;
        apiBtn.style.pointerEvents = 'auto';
        titleEl.innerText = originalTitle;
    }
}

// ==========================================
// 聊天气泡长按菜单与多选逻辑
// ==========================================
let bubblePressTimer;
let currentActionMsgIndex = null;
let isChatMultiSelecting = false;
let selectedMsgIndices = [];
let currentQuoteText = '';

// 1. 长按触发逻辑
function handleBubbleTouchStart(e, index) {
    if (isChatMultiSelecting) return; // 多选模式下禁用长按
    
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;

    bubblePressTimer = setTimeout(() => {
        currentActionMsgIndex = index;
        showChatBubbleMenu(clientX, clientY);
    }, 500); // 500ms 长按
}

function handleBubbleTouchEnd() {
    clearTimeout(bubblePressTimer);
}

// 2. 显示/隐藏菜单
function showChatBubbleMenu(x, y) {
    const overlay = document.getElementById('chatBubbleMenuOverlay');
    const menu = document.getElementById('chatBubbleMenu');
    
    // 控制撤回按钮只对用户自己的消息显示
    const currentLoginId = ChatDB.getItem('current_login_account');
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[currentActionMsgIndex];
    const recallBtn = document.getElementById('menuRecallBtn');
    if (recallBtn) {
        if (msg && msg.role === 'user') {
            recallBtn.style.display = 'flex';
        } else {
            recallBtn.style.display = 'none';
        }
    }

    overlay.classList.add('show');
    
    // 动态计算位置防止溢出
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        let finalX = x;
        let finalY = y;
        if (x + rect.width > window.innerWidth - 20) finalX = window.innerWidth - rect.width - 20;
        if (y + rect.height > window.innerHeight - 20) finalY = window.innerHeight - rect.height - 20;
        menu.style.left = finalX + 'px';
        menu.style.top = finalY + 'px';
        menu.classList.add('show');
    }, 10);
}

function closeChatBubbleMenu() {
    document.getElementById('chatBubbleMenu').classList.remove('show');
    setTimeout(() => {
        document.getElementById('chatBubbleMenuOverlay').classList.remove('show');
    }, 150);
}

// 3. 菜单具体操作
function actionQuoteMessage() {
    closeChatBubbleMenu();
    const currentLoginId = ChatDB.getItem('current_login_account');
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[currentActionMsgIndex];
    
    if (msg) {
        // 核心修复：如果 content 不存在，给一个空字符串，防止 replace 报错
        let content = msg.content || "";
        let text = content.replace(/<img[^>]*>/g, '[图片]');
        currentQuoteText = text;
        
        document.getElementById('crInputQuoteText').innerText = text;
        document.getElementById('crInputQuotePreview').classList.add('show');
        document.getElementById('chatRoomInput').focus();
    }
}

function cancelQuote() {
    currentQuoteText = '';
    document.getElementById('crInputQuotePreview').classList.remove('show');
}

let currentEditMsgType = 'text'; // 全局记录当前选中的修复类型

function actionEditMessage() {
    closeChatBubbleMenu();
    const currentLoginId = ChatDB.getItem('current_login_account');
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[currentActionMsgIndex];
    
    if (msg) {
        let safeContent = msg.content || '';
        let initialText = safeContent;
        currentEditMsgType = msg.type || 'text';

        // 1. 反向解析：把各种花里胡哨的卡片还原成纯文本，方便你手动编辑
        if (msg.type === 'transfer') {
            currentEditMsgType = 'transfer';
            initialText = `${msg.amount || 0} ${msg.note || "转账"}`; 
        } else if (msg.type === 'voice') {
            currentEditMsgType = 'voice';
        } else if (safeContent.includes('music-share-card') || msg.type === 'music_invite' || msg.type === 'family_card') {
            // 拦截音乐分享卡片、音乐邀请卡片、亲属卡，将其作为特殊文本处理，防止被误判为表情包
            currentEditMsgType = 'text';
            initialText = safeContent;
        } else if (msg.type === 'sticker' || (safeContent.includes('<img') && !safeContent.includes('chat-img-120'))) {
            currentEditMsgType = 'sticker';
            const match = safeContent.match(/src="([^"]+)"/);
            initialText = match ? match[1] : safeContent;
        } else if (safeContent.includes('chat-desc-img-120')) {
            currentEditMsgType = 'image';
            const match = safeContent.match(/<div class="img-text">([\s\S]*?)<\/div>/);
            if (match) initialText = match[1];
        } else if (msg.type === 'receipt' && safeContent.includes('wc-bubble-location-card')) {
            currentEditMsgType = 'location';
            const titleMatch = safeContent.match(/<div class="wc-bubble-location-title">(.*?)<\/div>/);
            initialText = titleMatch ? titleMatch[1] : "未知地点";
        } else {
            // 检测是否为双语翻译格式
            const hasTranslation = /<span[^>]*>([\s\S]*?)<\/span>/i.test(safeContent);
            if (hasTranslation) {
                currentEditMsgType = 'translate';
                const originalText = safeContent.replace(/(?:<br\s*\/?>|\n)*\s*<span[^>]*>[\s\S]*?<\/span>\s*/gi, '').replace(/^(<br\s*\/?>|\s)+|(<br\s*\/?>|\s)+$/gi, '');
                const translatedText = Array.from(safeContent.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map(m => m[1]).join('\n');
                initialText = `${originalText}\n${translatedText}`; 
            }
        }

        // 修复：精准清理系统前缀，不再使用模糊匹配，防止误删用户的【动作描写】
        const cleanRegex = /^(?:\[图片\]|\[语音\]|\[转账\]|\[赠送亲属卡\]|\[索要亲属卡\])\s*/g;
        let cleanedText = initialText.replace(cleanRegex, '').trim();
        
        // 如果清理后变成空了，说明原本就只有这些词，那就恢复原样
        if (cleanedText) {
            initialText = cleanedText;
        }

        document.getElementById('editMsgTextarea').value = initialText;
        
        // 2. 更新标签高亮状态
        updateEditMsgTagsUI(currentEditMsgType);
        
        document.getElementById('editMsgModalOverlay').classList.add('show');
    }
}

// 辅助函数：更新标签的 UI 高亮
function updateEditMsgTagsUI(type) {
    const tags = document.querySelectorAll('.edit-msg-tag');
    tags.forEach(tag => tag.classList.remove('active'));
    
    const typeMap = {
        'text': 0,
        'split': 1,
        'image': 2,
        'voice': 3,
        'sticker': 4,
        'transfer': 5,
        'location': 6,
        'translate': 7
    };
    
    const index = typeMap[type] !== undefined ? typeMap[type] : 0;
    if (tags[index]) tags[index].classList.add('active');
}

// 绑定标签点击事件：只切换类型和高亮，不自动保存
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-msg-tag')) {
        const text = e.target.innerText;
        
        if (text === '文本') currentEditMsgType = 'text';
        else if (text.includes('拆分')) currentEditMsgType = 'split';
        else if (text === '图片') currentEditMsgType = 'image';
        else if (text === '语音') currentEditMsgType = 'voice';
        else if (text === '表情包') currentEditMsgType = 'sticker';
        else if (text === '转账') currentEditMsgType = 'transfer';
        else if (text === '定位') currentEditMsgType = 'location';
        else if (text === '翻译') currentEditMsgType = 'translate';
        else currentEditMsgType = 'text'; 

        updateEditMsgTagsUI(currentEditMsgType);
    }
});

function closeEditMsgModal() {
    document.getElementById('editMsgModalOverlay').classList.remove('show');
}

function saveEditedMessage() {
    const newText = document.getElementById('editMsgTextarea').value.trim();
    if (newText !== '') {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        let msg = history[currentActionMsgIndex];

        // 3. 根据你选中的标签类型，将你编辑好的文本重新包装成对应的格式
        if (currentEditMsgType === 'split') {
            // 按换行符拆分文本为多条消息
            const lines = newText.split('\n').filter(line => line.trim() !== '');
            if (lines.length > 0) {
                msg.type = 'text';
                msg.content = lines[0].trim();
                
                for (let i = 1; i < lines.length; i++) {
                    const newMsg = {
                        ...msg, // 继承原消息的属性（如角色、时间戳等）
                        type: 'text',
                        content: lines[i].trim(),
                        timestamp: msg.timestamp + i 
                    };
                    history.splice(currentActionMsgIndex + i, 0, newMsg);
                }
            }
        } else if (currentEditMsgType === 'text') {
            msg.type = 'text';
            msg.content = newText;
        } else if (currentEditMsgType === 'image') {
            msg.type = 'image';
            msg.content = `<div class="chat-desc-img-120"><div class="img-text">${newText}</div></div>`;
        } else if (currentEditMsgType === 'voice') {
            msg.type = 'voice';
            msg.content = newText;
        } else if (currentEditMsgType === 'sticker') {
            msg.type = 'sticker';
            // 如果输入的是网址直接用，如果是文字则去匹配表情包库（这里简化为直接生成图片标签）
            msg.content = `<img src="${newText}" style="width: 100px; height: 100px; object-fit: contain; border-radius: 8px; display: block; margin: 5px 0;">`;
        } else if (currentEditMsgType === 'transfer') {
            msg.type = 'transfer';
            const match = newText.match(/(\d+(\.\d+)?)/);
            msg.amount = match ? match[1] : "100.00";
            msg.note = newText.replace(msg.amount, '').trim() || "转账";
            msg.status = 'pending';
            msg.content = '[转账]';
        } else if (currentEditMsgType === 'location') {
            msg.type = 'receipt';
            const safeLocTitle = newText.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
            msg.content = `
                <div class="wc-bubble-location-card" onclick="alert('定位：${safeLocTitle}')">
                    <div class="wc-bubble-location-map virtual">
                        <div class="ins-loc-marker virtual-marker"></div>
                    </div>
                    <div class="wc-bubble-location-info">
                        <div class="wc-bubble-location-title">${newText}</div>
                        <div class="wc-bubble-location-desc">定位</div>
                    </div>
                </div>
            `;
        } else if (currentEditMsgType === 'translate') {
            msg.type = 'text';
            const lines = newText.split('\n').filter(line => line.trim() !== '');
            if (lines.length >= 2) {
                const originalText = lines[0].trim();
                const translatedText = lines.slice(1).join(' ').trim();
                msg.content = `${originalText}<br><span style='font-size: 0.85em; opacity: 0.7;'>${translatedText}</span>`;
            } else {
                msg.content = `${newText}<br><span style='font-size: 0.85em; opacity: 0.7;'>[译文]</span>`;
            }
        }

        if (currentEditMsgType !== 'split') {
            history[currentActionMsgIndex] = msg;
        }
        
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        renderChatHistory(currentChatRoomCharId);
        closeEditMsgModal();
    } else {
        alert('消息内容不能为空！');
    }
}

function actionDeleteMessage() {
    closeChatBubbleMenu();
    if (confirm('确定删除这条消息吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        history.splice(currentActionMsgIndex, 1);
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        renderChatHistory(currentChatRoomCharId);
    }
}

function actionRecallMessage() {
    closeChatBubbleMenu();
    if (confirm('确定撤回这条消息吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        const msg = history[currentActionMsgIndex];
        
        if (msg) {
            const isUser = msg.role === 'user';
            const originalContent = msg.content;
            
            // 将原消息改为系统撤回提示，并保存原内容
            msg.type = 'system';
            msg.content = isUser ? '你撤回了一条消息' : '对方撤回了一条消息';
            msg.originalContent = originalContent; // 保存原内容用于点击查看
            
            history[currentActionMsgIndex] = msg;
            
            // 30% 概率触发 Char 感知 (仅限用户撤回自己的消息)，但不再自动回复！
            if (isUser && Math.random() < 0.3) {
                history.push({
                    role: 'user',
                    type: 'hidden_system',
                    content: `[User刚刚撤回了一条消息：“${originalContent}”。请根据你的人设，在接下来的对话中做出反应。]`,
                    timestamp: Date.now()
                });
            }
            
            ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
            renderChatHistory(currentChatRoomCharId);
        }
    }
}

// 4. 多选模式逻辑
function actionMultiSelect() {
    closeChatBubbleMenu();
    isChatMultiSelecting = true;
    selectedMsgIndices = [];
    
    document.getElementById('chatRoomHistory').classList.add('is-multi-selecting');
    document.getElementById('chatRoomBottomBar').style.display = 'none';
    document.getElementById('chatMultiActionBar').classList.add('show');
    
    // 默认选中当前长按的这条
    toggleMsgSelection(currentActionMsgIndex, document.querySelectorAll('.cr-msg-row')[currentActionMsgIndex]);
}

function exitMultiSelectMode() {
    isChatMultiSelecting = false;
    selectedMsgIndices = [];
    
    document.getElementById('chatRoomHistory').classList.remove('is-multi-selecting');
    document.getElementById('chatRoomBottomBar').style.display = 'flex';
    document.getElementById('chatMultiActionBar').classList.remove('show');
    
    // 取消所有勾选
    document.querySelectorAll('.cr-msg-checkbox').forEach(cb => cb.checked = false);
}

function toggleMsgSelection(index, rowEl) {
    const cb = rowEl.querySelector('.cr-msg-checkbox');
    if (selectedMsgIndices.includes(index)) {
        selectedMsgIndices = selectedMsgIndices.filter(i => i !== index);
        cb.checked = false;
    } else {
        selectedMsgIndices.push(index);
        cb.checked = true;
    }
}

function batchDeleteMessages() {
    if (selectedMsgIndices.length === 0) return alert('请先选择消息！');
    if (confirm(`确定删除选中的 ${selectedMsgIndices.length} 条消息吗？`)) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        
        // 从大到小排序删除，防止索引错乱
        selectedMsgIndices.sort((a, b) => b - a).forEach(idx => {
            history.splice(idx, 1);
        });
        
        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        exitMultiSelectMode();
        renderChatHistory(currentChatRoomCharId);
    }
}

// 5. 转发逻辑
function batchForwardMessages() {
    if (selectedMsgIndices.length === 0) return alert('请先选择消息！');
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    let allEntities = getAllEntities(); // 核心修复：使用 getAllEntities 包含用户账号
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    
    const listEl = document.getElementById('forwardContactList');
    listEl.innerHTML = '';
    
    const friends = contacts.map(id => allEntities.find(c => c.id === id)).filter(c => c && c.id !== currentChatRoomCharId);
    
    if (friends.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#aaa; font-size:12px;">暂无其他好友可转发</div>';
    } else {
        friends.forEach(f => {
            const displayName = remarks[f.id] || f.netName || f.name;
            const typeTag = f.isAccount ? '<span style="font-size:10px; background:#eee; color:#888; padding:2px 4px; border-radius:4px; margin-left:4px;">用户</span>' : '';
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: #f9f9f9; border-radius: 10px; cursor: pointer;';
            item.innerHTML = `
                <div style="width: 36px; height: 36px; border-radius: 8px; background-image: url('${f.avatarUrl || ''}'); background-size: cover; background-color: #eee;"></div>
                <div style="font-size: 14px; font-weight: bold; color: #333;">${displayName}${typeTag}</div>
            `;
            item.onclick = () => confirmForward(f.id);
            listEl.appendChild(item);
        });
    }
    
    document.getElementById('forwardModalOverlay').classList.add('show');
}

function closeForwardModal() {
    document.getElementById('forwardModalOverlay').classList.remove('show');
}

function confirmForward(targetCharId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let sourceHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
    
    let allEntities = getAllEntities(); // 核心修复：使用 getAllEntities
    const sourceChar = allEntities.find(c => c.id === currentChatRoomCharId);
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const me = accounts.find(a => a.id === currentLoginId);
    
    const myName = me ? me.netName : '我';
    const charName = sourceChar ? (sourceChar.netName || sourceChar.name) : '对方';

    // 提取选中的消息，过滤掉 undefined 防止报错
    let selectedMsgs = selectedMsgIndices.sort((a, b) => a - b).map(idx => sourceHistory[idx]).filter(m => m);
    
    // 生成预览行 (前3条)
    let previewLines = selectedMsgs.slice(0, 3).map(msg => {
        const name = msg.role === 'user' ? myName : charName;
        let content = msg.content || "";
        let text = content.includes('<img') ? '[图片/表情]' : content.replace(/<[^>]+>/g, ''); // 简单过滤HTML
        return `${name}: ${text}`;
    });

    // 构建转发对象
    const forwardMsg = {
        role: 'user',
        type: 'forward_record',
        content: '[聊天记录]', // 核心修复：增加 content 字段防止 undefined
        forwardTitle: `${myName}和${charName}的聊天记录`,
        forwardPreview: previewLines,
        sourceUserAvatar: me ? me.avatarUrl : '',
        sourceCharAvatar: sourceChar ? sourceChar.avatarUrl : '',
        forwardData: selectedMsgs.map(m => ({
            role: m.role,
            name: m.role === 'user' ? myName : charName,
            content: m.content
        })),
        timestamp: Date.now()
    };
    
    // 1. 存入自己的历史记录
    targetHistory.push(forwardMsg);
    ChatDB.setItem(`chat_history_${currentLoginId}_${targetCharId}`, JSON.stringify(targetHistory));
    
    // 更新自己的会话列表
    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    sessions = sessions.filter(id => id !== targetCharId);
    sessions.unshift(targetCharId);
    ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));

    // 2. 双向同步：存入对方的历史记录 (如果对方是用户账号，这点至关重要)
    const targetEntity = allEntities.find(e => e.id === targetCharId);
    if (targetEntity) {
        let targetOtherHistory = JSON.parse(ChatDB.getItem(`chat_history_${targetCharId}_${currentLoginId}`) || '[]');
        let targetOtherMsg = { ...forwardMsg, role: 'char' }; // 在对方视角，是我发给他的
        targetOtherHistory.push(targetOtherMsg);
        ChatDB.setItem(`chat_history_${targetCharId}_${currentLoginId}`, JSON.stringify(targetOtherHistory));

        let targetOtherSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${targetCharId}`) || '[]');
        targetOtherSessions = targetOtherSessions.filter(id => id !== currentLoginId);
        targetOtherSessions.unshift(currentLoginId);
        ChatDB.setItem(`chat_sessions_${targetCharId}`, JSON.stringify(targetOtherSessions));

        // 增加对方视角的未读数
        let unreadCount = parseInt(ChatDB.getItem(`unread_${targetCharId}_${currentLoginId}`) || '0');
        ChatDB.setItem(`unread_${targetCharId}_${currentLoginId}`, (unreadCount + 1).toString());
    }

    if (typeof renderChatList === 'function') renderChatList();
    
    alert('转发成功！');
    closeForwardModal();
    exitMultiSelectMode();
}
// 打开转发详情
function openForwardDetail(indexOrData) {
    const contentEl = document.getElementById('forwardDetailContent');
    contentEl.innerHTML = '';
    
    let dataToRender = [];

    // 判断传入的是索引号还是老版本的数据数组
    if (typeof indexOrData === 'number' || typeof indexOrData === 'string') {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        const msg = history[parseInt(indexOrData)];
        if (msg && msg.type === 'forward_record') {
            dataToRender = msg.forwardData;
        }
    } else if (Array.isArray(indexOrData)) {
        dataToRender = indexOrData; // 兼容老版本数据
    }

    dataToRender.forEach(item => {
        const div = document.createElement('div');
        // 移除了 flex 布局，改为垂直排列，并删除了头像 div
        div.style.cssText = 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #f5f5f5;';
        div.innerHTML = `
            <div style="font-size: 12px; color: #888; margin-bottom: 6px; font-weight: bold;">${item.name}</div>
            <div style="font-size: 15px; color: #333; line-height: 1.5; word-break: break-all;">${item.content || ""}</div>
        `;
        contentEl.appendChild(div);
    });
    
    document.getElementById('forwardDetailOverlay').classList.add('show');
}

function closeForwardDetail() {
    document.getElementById('forwardDetailOverlay').classList.remove('show');
}
// ==========================================
// 转账功能逻辑
// ==========================================
let currentTransferNote = ''; // 临时保存转账说明

function openTransferPanel() {
    if (!currentChatRoomCharId) return;
    
    // 获取当前聊天对象的信息
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    const currentLoginId = ChatDB.getItem('current_login_account');
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    const displayName = remarks[char.id] || char.netName || char.name || '未命名';

    // 填充头像和名字
    document.getElementById('transferTargetAvatar').style.backgroundImage = `url('${char.avatarUrl || ''}')`;
    document.getElementById('transferTargetName').innerText = displayName;
    
    // 重置输入框和说明
    document.getElementById('transferAmountInput').value = '';
    currentTransferNote = '';
    document.getElementById('transferNoteText').innerText = '添加转账说明';

    document.getElementById('transferPanel').style.display = 'flex';
}

function closeTransferPanel() {
    document.getElementById('transferPanel').style.display = 'none';
}

// --- 转账说明弹窗 ---
function openTransferNoteModal() {
    document.getElementById('transferNoteInput').value = currentTransferNote;
    document.getElementById('transferNoteModalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('transferNoteInput').focus(), 100);
}

function closeTransferNoteModal() {
    document.getElementById('transferNoteModalOverlay').classList.remove('show');
}

function saveTransferNote() {
    const note = document.getElementById('transferNoteInput').value.trim();
    currentTransferNote = note;
    
    const noteTextEl = document.getElementById('transferNoteText');
    if (note) {
        noteTextEl.innerText = `转账说明：${note}`;
        noteTextEl.style.color = '#333';
    } else {
        noteTextEl.innerText = '添加转账说明';
        noteTextEl.style.color = '#576b95';
    }
    closeTransferNoteModal();
}

// --- 确认转账 ---
let pendingTransferAmount = 0;

function confirmTransfer() {
    const amount = document.getElementById('transferAmountInput').value;
    if (!amount || parseFloat(amount) <= 0) {
        return alert('请输入正确的转账金额！');
    }
    pendingTransferAmount = parseFloat(amount).toFixed(2);
    openPaymentPanel(pendingTransferAmount);
}

// --- 点击转账气泡逻辑 ---
let currentActionTransferIndex = null;

function handleTransferClick(index) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[index];

    if (!msg || msg.type !== 'transfer') return;

    // 如果已经收款或退还，点击无反应
    if (msg.status === 'received' || msg.status === 'rejected' || msg.status === 'refunded') {
        return;
    }

    if (msg.role === 'user') {
        // 我发出的转账，不能自己收，只能等 AI 处理
        alert('等待对方收款...');
        return;
    }

    // 只有对方发出的转账，才弹出我的操作菜单
    currentActionTransferIndex = index;
    const modal = document.getElementById('transferActionModalOverlay');
    const receiveBtn = document.getElementById('transferBtnReceive');
    const rejectBtn = document.getElementById('transferBtnReject');

    receiveBtn.innerText = '确认收款';
    rejectBtn.innerText = '退还';
    modal.classList.add('show');
}

function closeTransferActionModal() {
    document.getElementById('transferActionModalOverlay').classList.remove('show');
}

function processTransferAction(action) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId || currentActionTransferIndex === null) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[currentActionTransferIndex];

    if (msg && msg.type === 'transfer') {
        msg.status = action; // 'received' 或 'rejected'
        
        // --- 新增：处理钱包余额与账单 ---
        let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        const char = chars.find(c => c.id === currentChatRoomCharId);
        const charName = char ? (char.netName || char.name) : '对方';

        if (msg.role === 'user' && action === 'rejected') {
            addWalletRecord(currentLoginId, 'refund', `转账退还 - ${charName}`, msg.amount);
        } else if (msg.role === 'char' && action === 'received') {
            addWalletRecord(currentLoginId, 'in', `收到转账 - ${charName}`, msg.amount);
        }
        // ------------------------------

        ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
        
        // --- 新增：双向同步状态给对方 ---
        let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
        let targetMsgIndex = targetHistory.findIndex(m => m.type === 'transfer' && m.timestamp === msg.timestamp);
        if (targetMsgIndex !== -1) {
            targetHistory[targetMsgIndex].status = action;
            ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));
        }
        // ---------------------------
        
        renderChatHistory(currentChatRoomCharId);
    }
    closeTransferActionModal();
}
// ==========================================
// 钱包功能核心逻辑
// ==========================================
function openWalletPanel() {
    document.getElementById('walletPanel').style.display = 'flex';
    renderWallet();
}

function closeWalletPanel() {
    document.getElementById('walletPanel').style.display = 'none';
}

function renderWallet() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    // 1. 渲染主余额
    let balance = parseFloat(ChatDB.getItem(`wallet_balance_${currentLoginId}`) || '0');
    document.getElementById('walletBalanceText').innerText = balance.toFixed(2);

    // 2. 渲染卡片列表 (银行卡 + 亲属卡)
    const slider = document.getElementById('walletCardsSlider');
    const dotsContainer = document.getElementById('walletSliderDots');
    
    // 保留第一张银行卡，移除后面的
    const bankCard = slider.querySelector('.wallet-bank-card');
    slider.innerHTML = '';
    slider.appendChild(bankCard);
    dotsContainer.innerHTML = '<div class="slider-dot active"></div>';

    // 核心修改：遍历所有实体（排除自己），这样 Char 登录时就能遍历到 User，从而显示 User 送的卡
    let allEntities = getAllEntities().filter(e => e.id !== currentLoginId);
    allEntities.forEach(char => {
        const receivedCard = JSON.parse(ChatDB.getItem(`family_card_received_${currentLoginId}_${char.id}`) || 'null');
        if (receivedCard) {
            const charName = char.netName || char.name;
            const cardEl = document.createElement('div');
            cardEl.className = 'family-card-gold';
            cardEl.innerHTML = `
                <div class="wallet-card-top">
                    <div class="wallet-card-label">FAMILY CARD</div>
                    <div class="wallet-card-chip" style="background: linear-gradient(135deg, #d4af37, #aa8a2e);"></div>
                </div>
                <div class="wallet-card-balance"><span>¥</span>${receivedCard.limit.toFixed(2)}</div>
                <div class="wallet-card-bottom">
                    <div class="wallet-card-number">赠予人：${charName}</div>
                    <div class="family-card-user">可用额度</div>
                </div>
            `;
            slider.appendChild(cardEl);
            
            // 添加指示点
            const dot = document.createElement('div');
            dot.className = 'slider-dot';
            dotsContainer.appendChild(dot);
        }
    });

    // 3. 监听滑动更新指示点
    slider.onscroll = () => {
        const index = Math.round(slider.scrollLeft / slider.offsetWidth);
        const dots = dotsContainer.querySelectorAll('.slider-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
    };

    // 4. 渲染账单记录 (保持原样)
    const listEl = document.getElementById('walletHistoryList');
    listEl.innerHTML = '';
    let history = JSON.parse(ChatDB.getItem(`wallet_history_${currentLoginId}`) || '[]');
    if (history.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#aaa; font-size:12px; padding:20px 0;">暂无账单记录</div>';
    } else {
        history.slice().reverse().forEach(record => {
            const item = document.createElement('div');
            item.className = 'wallet-history-item';
            let iconClass = record.type === 'out' ? 'wallet-icon-out' : (record.type === 'in' ? 'wallet-icon-in' : 'wallet-icon-refund');
            let iconSvg = record.type === 'out' ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>` : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
            const date = new Date(record.timestamp);
            const timeStr = `${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
            item.innerHTML = `
                <div class="wallet-history-icon ${iconClass}">${iconSvg}</div>
                <div class="wallet-history-info">
                    <div class="wallet-history-name">${record.title}</div>
                    <div class="wallet-history-time">${timeStr}</div>
                </div>
                <div class="wallet-history-amount ${record.type === 'out' ? 'wallet-amount-minus' : 'wallet-amount-plus'}">${record.type === 'out' ? '-' : '+'}${parseFloat(record.amount).toFixed(2)}</div>
            `;
            listEl.appendChild(item);
        });
    }
}

// 添加账单记录并更新余额的通用函数
function addWalletRecord(accountId, type, title, amount) {
    let balance = parseFloat(ChatDB.getItem(`wallet_balance_${accountId}`) || '0');
    let parsedAmount = parseFloat(amount);

    if (type === 'out') {
        balance -= parsedAmount;
    } else {
        balance += parsedAmount;
    }

    ChatDB.setItem(`wallet_balance_${accountId}`, balance.toFixed(2));

    let history = JSON.parse(ChatDB.getItem(`wallet_history_${accountId}`) || '[]');
    history.push({
        id: Date.now().toString(),
        type: type, // 'out', 'in', 'refund'
        title: title,
        amount: parsedAmount.toFixed(2),
        timestamp: Date.now()
    });
    ChatDB.setItem(`wallet_history_${accountId}`, JSON.stringify(history));
}

function handleWalletRecharge() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;
    const amount = prompt('请输入充值金额：');
    if (amount && parseFloat(amount) > 0) {
        addWalletRecord(currentLoginId, 'in', '系统充值', amount);
        renderWallet();
        alert('充值成功！');
    }
}

function handleWalletWithdraw() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;
    let balance = parseFloat(ChatDB.getItem(`wallet_balance_${currentLoginId}`) || '0');
    const amount = prompt(`当前可提现余额: ¥${balance.toFixed(2)}\n请输入提现金额：`);
    if (amount && parseFloat(amount) > 0) {
        if (parseFloat(amount) > balance) return alert('余额不足！');
        addWalletRecord(currentLoginId, 'out', '余额提现', amount);
        renderWallet();
        alert('提现成功！');
    }
}

function clearWalletHistory() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;
    if (confirm('确定要清空所有账单记录吗？（余额不会清空）')) {
        ChatDB.setItem(`wallet_history_${currentLoginId}`, '[]');
        renderWallet();
    }
}
//// ==========================================
// 支付密码与亲属卡核心逻辑 (严格数据隔离)
// ==========================================
let currentPaymentMethod = 'wallet'; // 'wallet' 或 'family_card'

function openPaymentPanel(amount) {
    document.getElementById('paymentAmountText').innerText = `¥ ${amount}`;
    document.getElementById('payPasswordInput').value = '';
    updatePasswordDots(0);
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    
    // 检查免密支付状态
    if (account && account.freePay) {
        document.getElementById('payPwdInputArea').style.display = 'none';
        document.getElementById('freePayConfirmBtn').style.display = 'block';
        document.getElementById('payPwdHintText').innerText = '已开启免密支付';
    } else {
        document.getElementById('payPwdInputArea').style.display = 'flex';
        document.getElementById('freePayConfirmBtn').style.display = 'none';
        document.getElementById('payPwdHintText').innerText = '请输入支付密码';
    }
    
    // 检查我收到的亲属卡 (对方赠送给我的)
    const familyCard = JSON.parse(ChatDB.getItem(`family_card_received_${currentLoginId}_${currentChatRoomCharId}`) || 'null');
    
    const methodTextEl = document.getElementById('paymentMethodText');
    if (familyCard && familyCard.limit >= parseFloat(amount)) {
        currentPaymentMethod = 'family_card';
        methodTextEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#ff9e00"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> 亲属卡 (剩余 ¥${familyCard.limit.toFixed(2)})`;
    } else {
        currentPaymentMethod = 'wallet';
        methodTextEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#333" stroke-width="2" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg> 钱包余额`;
    }

    document.getElementById('paymentPanelOverlay').classList.add('show');
    if (!account || !account.freePay) {
        setTimeout(() => document.getElementById('payPasswordInput').focus(), 100);
    }
}

function closePaymentPanel() {
    document.getElementById('paymentPanelOverlay').classList.remove('show');
}

function togglePaymentMethod() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const familyCard = JSON.parse(ChatDB.getItem(`family_card_received_${currentLoginId}_${currentChatRoomCharId}`) || 'null');
    const methodTextEl = document.getElementById('paymentMethodText');

    if (currentPaymentMethod === 'wallet') {
        if (familyCard) {
            currentPaymentMethod = 'family_card';
            methodTextEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#ff9e00"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> 亲属卡 (剩余 ¥${familyCard.limit.toFixed(2)})`;
        } else {
            alert('对方尚未赠送你亲属卡！');
        }
    } else {
        currentPaymentMethod = 'wallet';
        methodTextEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#333" stroke-width="2" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg> 钱包余额`;
    }
}

function handlePasswordInput() {
    const val = document.getElementById('payPasswordInput').value;
    updatePasswordDots(val.length);
    
    if (val.length === 6) {
        setTimeout(() => {
            executePayment();
        }, 200);
    }
}

function updatePasswordDots(length) {
    // 修复：去掉 .pwd-box 类名限制，直接选择子 div
    const boxes = document.querySelectorAll('#pwdDotsContainer > div');
    boxes.forEach((box, idx) => {
        if (idx < length) {
            box.innerHTML = '<div style="width: 12px; height: 12px; background: #111; border-radius: 50%;"></div>';
        } else {
            box.innerHTML = '';
        }
    });
}

function executePayment(isFreePay = false) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;

    // 1. 获取当前账号信息校验支付密码 (兼容 Char)
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === currentLoginId);
    if (!account) return;

    if (!isFreePay) {
        const inputPass = document.getElementById('payPasswordInput').value;

        if (!account.payPassword) {
            alert('您尚未设置支付密码，请前往“我-设置-支付密码管理”进行设置。');
            document.getElementById('payPasswordInput').value = '';
            updatePasswordDots(0);
            return;
        }

        if (inputPass !== account.payPassword) {
            alert('支付密码错误！');
            document.getElementById('payPasswordInput').value = '';
            updatePasswordDots(0);
            return;
        }
    }

    // 2. 校验通过，执行原有支付逻辑
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    const charName = char ? (char.netName || char.name) : '对方';
    const transferAmount = parseFloat(pendingTransferAmount);

    if (currentPaymentMethod === 'wallet') {
        let balance = parseFloat(ChatDB.getItem(`wallet_balance_${currentLoginId}`) || '0');
        if (balance < transferAmount) {
            document.getElementById('payPasswordInput').value = '';
            updatePasswordDots(0);
            return alert('钱包余额不足，请充值！');
        }
        addWalletRecord(currentLoginId, 'out', `转账 - ${charName}`, transferAmount);
    } else if (currentPaymentMethod === 'family_card') {
        let familyCard = JSON.parse(ChatDB.getItem(`family_card_received_${currentLoginId}_${currentChatRoomCharId}`) || 'null');
        if (!familyCard || familyCard.limit < transferAmount) {
            document.getElementById('payPasswordInput').value = '';
            updatePasswordDots(0);
            return alert('亲属卡额度不足！');
        }
        familyCard.limit -= transferAmount;
        ChatDB.setItem(`family_card_received_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(familyCard));
    }

    // 支付成功，发送转账消息
    let newMsg = {
        role: 'user', type: 'transfer', amount: pendingTransferAmount,
        note: currentTransferNote || '转账给对方', status: 'pending', content: '[转账]', timestamp: Date.now()
    };
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    history.push(newMsg);
    ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
    
    // --- 新增：双向同步给对方 ---
    let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
    let targetMsg = { ...newMsg, role: 'char' };
    targetHistory.push(targetMsg);
    ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

    let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
    targetSessions = targetSessions.filter(id => id !== currentLoginId);
    targetSessions.unshift(currentLoginId);
    ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));

    let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
    ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
    // ---------------------------
    
    closePaymentPanel();
    closeTransferPanel();
    renderChatHistory(currentChatRoomCharId);
}

// --- 亲属卡发送/索要逻辑 ---
let currentFcTab = 'gift';

function switchFcTab(tab) {
    currentFcTab = tab;
    if (tab === 'gift') {
        document.getElementById('fcTabGift').style.color = '#111';
        document.getElementById('fcTabGift').style.borderBottomColor = '#111';
        document.getElementById('fcTabRequest').style.color = '#888';
        document.getElementById('fcTabRequest').style.borderBottomColor = 'transparent';
        document.getElementById('fcGiftContent').style.display = 'flex';
        document.getElementById('fcRequestContent').style.display = 'none';
    } else {
        document.getElementById('fcTabRequest').style.color = '#111';
        document.getElementById('fcTabRequest').style.borderBottomColor = '#111';
        document.getElementById('fcTabGift').style.color = '#888';
        document.getElementById('fcTabGift').style.borderBottomColor = 'transparent';
        document.getElementById('fcRequestContent').style.display = 'flex';
        document.getElementById('fcGiftContent').style.display = 'none';
    }
}

function closeSendFamilyCardModal() {
    document.getElementById('sendFamilyCardModalOverlay').classList.remove('show');
}

function confirmSendFamilyCard() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    
    let newMsg = {
        role: 'user', type: 'family_card',
        status: 'pending', timestamp: Date.now()
    };

    if (currentFcTab === 'gift') {
        const limit = document.getElementById('familyCardLimitInput').value;
        if (!limit || parseFloat(limit) <= 0) return alert('请输入正确的额度！');
        newMsg.subType = 'gift';
        newMsg.limit = parseFloat(limit).toFixed(2);
        newMsg.content = '[赠送亲属卡]';
    } else {
        newMsg.subType = 'request';
        newMsg.content = '[索要亲属卡]';
    }
    
    history.push(newMsg);
    ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));

    // --- 新增：双向同步给对方 ---
    let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
    let targetMsg = { ...newMsg, role: 'char' }; // 对方视角里，是我(char)发的
    targetHistory.push(targetMsg);
    ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

    let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
    targetSessions = targetSessions.filter(id => id !== currentLoginId);
    targetSessions.unshift(currentLoginId);
    ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));

    let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
    ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
    // ---------------------------

    closeSendFamilyCardModal();
    renderChatHistory(currentChatRoomCharId);
}

function handleFamilyCardClick(index) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[index];

    if (!msg || msg.type !== 'family_card' || msg.status === 'received') return;

    if (msg.role === 'user') {
        alert('等待对方处理...');
    } else {
        if (msg.subType === 'gift') {
            // 对方赠送给我，我点击领取
            if (confirm(`是否领取对方赠送的亲属卡？\n额度：¥${msg.limit}`)) {
                msg.status = 'received';
                ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
                
                // --- 新增：双向同步状态给对方 ---
                let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
                let targetMsgIndex = targetHistory.findIndex(m => m.type === 'family_card' && m.timestamp === msg.timestamp);
                if (targetMsgIndex !== -1) {
                    targetHistory[targetMsgIndex].status = 'received';
                    ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));
                }
                // ---------------------------
                
                // 存入我收到的亲属卡库
                ChatDB.setItem(`family_card_received_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify({ limit: parseFloat(msg.limit) }));
                renderChatHistory(currentChatRoomCharId);
                alert('领取成功！支付时可选择使用亲属卡。');
            }
        } else if (msg.subType === 'request') {
            // 对方索要，我点击同意并设置额度
            const limit = prompt('对方请求开通亲属卡，请输入你愿意给的每月额度：');
            if (limit && parseFloat(limit) > 0) {
                msg.status = 'received'; // 标记索要请求已处理
                
                // --- 新增：双向同步索要状态给对方 ---
                let targetHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`) || '[]');
                let targetMsgIndex = targetHistory.findIndex(m => m.type === 'family_card' && m.timestamp === msg.timestamp);
                if (targetMsgIndex !== -1) {
                    targetHistory[targetMsgIndex].status = 'received';
                    ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));
                }
                // ---------------------------
                
                // 发送一张赠送卡
                let newGiftMsg = {
                    role: 'user', type: 'family_card', subType: 'gift', limit: parseFloat(limit).toFixed(2),
                    status: 'pending', content: '[赠送亲属卡]', timestamp: Date.now()
                };
                history.push(newGiftMsg);
                ChatDB.setItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(history));
                
                // --- 新增：双向同步赠送卡给对方 ---
                let targetMsg = { ...newGiftMsg, role: 'char' };
                targetHistory.push(targetMsg);
                ChatDB.setItem(`chat_history_${currentChatRoomCharId}_${currentLoginId}`, JSON.stringify(targetHistory));

                let targetSessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentChatRoomCharId}`) || '[]');
                targetSessions = targetSessions.filter(id => id !== currentLoginId);
                targetSessions.unshift(currentLoginId);
                ChatDB.setItem(`chat_sessions_${currentChatRoomCharId}`, JSON.stringify(targetSessions));

                let unreadCount = parseInt(ChatDB.getItem(`unread_${currentChatRoomCharId}_${currentLoginId}`) || '0');
                ChatDB.setItem(`unread_${currentChatRoomCharId}_${currentLoginId}`, (unreadCount + 1).toString());
                // ---------------------------
                
                renderChatHistory(currentChatRoomCharId);
            }
        }
    }
}

// 劫持 renderWallet，在钱包里渲染亲属卡 (区分赠出和收到)
const _originalRenderWallet = renderWallet;
renderWallet = function() {
    // 先执行原始渲染逻辑（渲染银行卡和收到的亲属卡）
    _originalRenderWallet();
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    const slider = document.getElementById('walletCardsSlider');
    const dotsContainer = document.getElementById('walletSliderDots');
    
    if (!slider || !dotsContainer) return;

    // 核心修改：遍历所有实体（排除自己），这样 Char 登录时就能看到自己送给 User 的卡
    let allEntities = getAllEntities().filter(e => e.id !== currentLoginId);
    
    allEntities.forEach(char => {
        // 渲染我赠出的卡 (我给别人的)，将其添加到滑动容器中
        const giftedCard = JSON.parse(ChatDB.getItem(`family_card_gifted_${currentLoginId}_${char.id}`) || 'null');
        if (giftedCard) {
            const charName = char.netName || char.name;
            const cardEl = document.createElement('div');
            cardEl.className = 'family-card-gold';
            cardEl.style.background = '#fff'; 
            cardEl.style.color = '#333';
            cardEl.style.border = '1px solid #eee';
            cardEl.innerHTML = `
                <div class="wallet-card-top">
                    <div class="wallet-card-label" style="color: #aaa;">GIFTED CARD</div>
                    <div class="wallet-card-chip" style="background: #eee;"></div>
                </div>
                <div class="wallet-card-balance" style="color: #111;"><span>¥</span>${giftedCard.limit.toFixed(2)}</div>
                <div class="wallet-card-bottom">
                    <div class="wallet-card-number" style="color: #aaa;">使用者：${charName}</div>
                    <div class="family-card-user">剩余额度</div>
                </div>
            `;
            slider.appendChild(cardEl);
            
            // 同步添加底部的滑动指示点
            const dot = document.createElement('div');
            dot.className = 'slider-dot';
            dotsContainer.appendChild(dot);
        }
    });
};

// 劫持 AI 回复逻辑，让 AI 也能发亲属卡、领亲属卡，以及【主动发朋友圈/互动朋友圈】
const _originalGenerateApiReply = generateApiReply;
generateApiReply = async function(isProactive = false, proactiveCharId = null) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const targetCharId = isProactive ? proactiveCharId : currentChatRoomCharId;
    if (!currentLoginId || !targetCharId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
    
    let hasPendingGift = history.some(m => m.role === 'user' && m.type === 'family_card' && m.subType === 'gift' && m.status === 'pending');
    let hasPendingRequest = history.some(m => m.role === 'user' && m.type === 'family_card' && m.subType === 'request' && m.status === 'pending');
    
    // 获取当前角色信息
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === targetCharId);
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const me = accounts.find(a => a.id === currentLoginId);
    const myName = me ? (me.netName || 'User') : 'User';
    const charName = char ? (char.name || 'Char') : 'Char';

    // 提取最近的朋友圈动态 (过滤掉不可见的)
    let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
    let visibleMoments = moments.filter(m => {
        if (m.visibility === 'all' || !m.visibility) return true;
        return char && char.contactGroup === m.visibility;
    }).slice(-5); // 取最近 5 条

    let momentsContext = "";
    if (visibleMoments.length > 0) {
        momentsContext = "\n【朋友圈实时情报】\n";
        momentsContext += `以下是你和 ${myName} 能够看到的最近动态，你可以根据这些内容在聊天中展开话题，或者直接在 JSON 中输出互动：\n`;
        visibleMoments.forEach(m => {
            let authorRole = "";
            if (m.authorId === currentLoginId) authorRole = `用户 ${myName} (你关注的人)`;
            else if (m.authorId === targetCharId) authorRole = `你 (${charName}) 自己发布的`;
            else authorRole = "其他共同好友";

            let imgInfo = "";
            if (m.images && m.images.length > 0) {
                imgInfo = m.images.map(img => img.type === 'desc' ? `[图片描述: ${img.text}]` : "[真实图片]").join(" ");
            }

            let comments = (m.comments || []).map(c => {
                let cAuthor = c.authorId === currentLoginId ? myName : (c.authorId === targetCharId ? "你" : "其他好友");
                return `${cAuthor}: ${c.content}`;
            }).join(" | ");

            momentsContext += `[动态ID: ${m.id}]\n作者: ${authorRole}\n内容: ${m.content}\n配图: ${imgInfo || '无'}\n评论区: ${comments || '暂无评论'}\n---\n`;
        });
    }

    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        if (url.includes('/chat/completions') && options.body) {
            let bodyObj = JSON.parse(options.body);
            let sysMsg = bodyObj.messages.find(m => m.role === 'system');
            if (sysMsg) {
                // 注入亲属卡规则
                sysMsg.content += `\n【亲属卡互动规则】\n`;
                sysMsg.content += `1. 主动赠送亲属卡: {"type":"family_card_gift", "limit":"额度(纯数字)"}\n`;
                sysMsg.content += `2. 主动索要亲属卡: {"type":"family_card_request"}\n`;
                sysMsg.content += `3. 领取对方赠送的亲属卡: {"type":"family_card_action", "action":"received", "content":"感谢的话"}\n`;
                sysMsg.content += `4. 拒绝对方赠送的亲属卡: {"type":"family_card_action", "action":"rejected", "content":"拒绝的话"}\n`;
                sysMsg.content += `5. 同意对方索要亲属卡: {"type":"family_card_gift", "limit":"额度(纯数字)"}\n`;
                sysMsg.content += `6. 拒绝对方索要亲属卡: {"type":"family_card_action", "action":"rejected", "content":"拒绝的话"}\n`;
                if (hasPendingGift) {
                    sysMsg.content += `- 对方送了你一张亲属卡，你可以根据人设选择领取(输出 {"type":"family_card_action", "action":"received"}) 或 拒绝(输出 {"type":"family_card_action", "action":"rejected"})！\n`;
                }
                if (hasPendingRequest) {
                    sysMsg.content += `- 对方正在向你索要亲属卡，你可以根据人设选择同意赠送(输出 {"type":"family_card_gift", "limit":"额度"}) 或 拒绝(输出 {"type":"family_card_action", "action":"rejected"})。\n`;
                }

                // 注入一起听歌规则
                let hasPendingMusicInvite = history.some(m => m.role === 'user' && m.type === 'music_invite' && m.status === 'pending');
                sysMsg.content += `\n【一起听歌互动规则】\n`;
                sysMsg.content += `1. 同意一起听歌: {"type":"music_invite_action", "action":"accept", "content":"同意的话"}\n`;
                sysMsg.content += `2. 拒绝一起听歌: {"type":"music_invite_action", "action":"reject", "content":"拒绝的话"}\n`;
                sysMsg.content += `3. 主动邀请一起听歌: {"type":"music_invite_proactive", "content":"邀请的话"}\n`;
                if (hasPendingMusicInvite) {
                    sysMsg.content += `- 对方邀请你一起听歌，请务必输出 {"type":"music_invite_action", "action":"accept" 或 "reject"} 来回应！\n`;
                }
                sysMsg.content += `- 如果你想和对方一起听歌，可以随时输出 {"type":"music_invite_proactive"} 发起邀请。\n`;

                // 【新增】：实时音乐状态感知与控制
                if (typeof window.currentListenTogetherCharId !== 'undefined' && window.currentListenTogetherCharId === targetCharId) {
                    const passedMinutes = typeof listenTogetherStartTime !== 'undefined' ? Math.floor((Date.now() - listenTogetherStartTime) / 60000) : 0;
                    const songName = typeof currentPlayingSong !== 'undefined' && currentPlayingSong ? `${currentPlayingSong.title} - ${currentPlayingSong.artist}` : '无';
                    const playState = (typeof audioPlayer !== 'undefined' && audioPlayer.paused) ? '已暂停' : '播放中';
                    const plNames = (typeof window.currentPlaylistTracks !== 'undefined' && window.currentPlaylistTracks.length > 0) ? window.currentPlaylistTracks.map(t=>t.title).slice(0,5).join(', ') + '...' : '空';
                    const currentLyric = typeof window.currentPlayingLyric !== 'undefined' ? window.currentPlayingLyric.substring(0, 300) + '...' : '无'; // 截取前300字防止过长

                    sysMsg.content += `\n【当前一起听歌实时状态】\n`;
                    sysMsg.content += `- 当前播放: ${songName} (${playState})\n`;
                    sysMsg.content += `- 当前歌词片段: ${currentLyric}\n`;
                    sysMsg.content += `- 已听时长: ${passedMinutes} 分钟\n`;
                    sysMsg.content += `- 播放列表前5首: ${plNames}\n`;
                    sysMsg.content += `你可以通过 JSON 控制音乐播放器，添加字段 "music_control": {"action": "指令", "target": "参数"}。\n`;

                    sysMsg.content += `支持的 action 指令: play(继续播放), pause(暂停), next(下一首), prev(上一首), play_song(点歌, target填歌名), add_song(添加歌曲到列表, target填歌名), remove_song(从列表删除, target填歌名), exit(主动退出一起听歌)。\n`;
                    sysMsg.content += `请根据用户的聊天内容和当前音乐状态，自然地进行互动或控制音乐。\n`;
                }

                // 注入朋友圈规则
                sysMsg.content += momentsContext;
                sysMsg.content += `\n【朋友圈深度互动指南】\n`;
                sysMsg.content += `1. 话题延续：如果 ${myName} 刚发了朋友圈，你可以在聊天回复中提到它（例如：“看到你发的海边照片了...”）。\n`;
                sysMsg.content += `2. 异步互动：你也可以不在聊天中提起，而是直接通过 "moment_interactions" 字段给那条动态点赞或评论。\n`;
                sysMsg.content += `3. 自我展示：如果聊天聊到了某个精彩瞬间，你可以通过 "moment_post" 同步发布一条朋友圈，记得带上生动的图片描述。\n`;
                sysMsg.content += `4. 回复评论：如果朋友圈情报显示 ${myName} 评论了你的动态，请务必通过 "moment_interactions" 进行回复评论。\n`;
                sysMsg.content += `注意：所有朋友圈操作都是可选的，只有在符合人设和逻辑时才执行。输出格式必须严格遵守 JSON 结构。\n`;
                sysMsg.content += `JSON 根节点必须包含以下可选字段：\n`;
                sysMsg.content += `"moment_post": {"content": "文字内容(可选)", "imageDesc": "图片描述(可选)"},\n`;
                sysMsg.content += `- 纯文本：只填写 content，imageDesc 留空。\n`;
                sysMsg.content += `- 纯图片：只填写 imageDesc，content 留空。\n`;
                sysMsg.content += `- 图文结合：两者都填写。\n`;
                sysMsg.content += `"moment_interactions": [\n`;
                sysMsg.content += `  {"action": "like", "momentId": "动态ID"},\n`;
                sysMsg.content += `  {"action": "comment", "momentId": "动态ID", "content": "评论内容"}\n`;
                sysMsg.content += `]\n`;

                // 【新增】：账号信息修改规则
                sysMsg.content += `\n【账号信息修改规则】\n`;
                sysMsg.content += `如果你想修改自己的网名、个性签名或登录密码，可以在 JSON 根节点添加 "update_profile" 字段：\n`;
                sysMsg.content += `"update_profile": {"netName": "新网名", "signature": "新签名", "password": "新密码"}\n`;
                sysMsg.content += `(不需要修改的字段可以不写)\n`;
            }
            options.body = JSON.stringify(bodyObj);
        }
        
        // 拦截响应，处理朋友圈 JSON
        const response = await originalFetch.apply(this, arguments);
        const clonedResponse = response.clone();
        
        clonedResponse.json().then(data => {
            if (data && data.choices && data.choices[0] && data.choices[0].message) {
                let replyRaw = data.choices[0].message.content.trim();
                replyRaw = replyRaw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
                try {
                    const jsonMatch = replyRaw.match(/\{[\s\S]*\}/s);
                    const jsonStr = jsonMatch ? jsonMatch[0] : replyRaw;
                    const parsedData = JSON.parse(jsonStr);
                    
                    // 【新增】：处理 char 自主修改个人信息
                    if (parsedData.update_profile) {
                        let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
                        let charIndex = allChars.findIndex(c => c.id === targetCharId);
                        if (charIndex !== -1) {
                            let updated = false;
                            if (parsedData.update_profile.netName) {
                                allChars[charIndex].netName = parsedData.update_profile.netName;
                                updated = true;
                            }
                            if (parsedData.update_profile.signature) {
                                allChars[charIndex].signature = parsedData.update_profile.signature;
                                updated = true;
                            }
                            if (parsedData.update_profile.password) {
                                allChars[charIndex].password = parsedData.update_profile.password;
                                updated = true;
                            }
                            if (updated) {
                                ChatDB.setItem('chat_chars', JSON.stringify(allChars));
                                // 刷新相关 UI
                                if (typeof renderChatList === 'function') renderChatList();
                                if (typeof renderContactList === 'function') renderContactList();
                                if (targetCharId === currentChatRoomCharId) {
                                    updateChatRoomTitleBadge(targetCharId);
                                }
                            }
                        }
                    }

                    let momentsUpdated = false;
                    let allMoments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');

                    // 处理 AI 发朋友圈 (支持纯文本、纯图片、图文结合)
                    if (parsedData.moment_post && (parsedData.moment_post.content || parsedData.moment_post.imageDesc)) {
                        let images = [];
                        if (parsedData.moment_post.imageDesc && parsedData.moment_post.imageDesc.trim() !== '') {
                            images.push({ type: 'desc', text: parsedData.moment_post.imageDesc.trim() });
                        }
                        allMoments.push({
                            id: Date.now().toString(),
                            authorId: targetCharId,
                            content: parsedData.moment_post.content || '',
                            images: images,
                            visibility: 'all',
                            timestamp: Date.now(),
                            likes: [],
                            comments: []
                        });
                        momentsUpdated = true;
                    }

                    // 【新增】：处理 AI 音乐控制指令
                    if (parsedData.music_control && typeof window.handleAiMusicControl === 'function') {
                        window.handleAiMusicControl(parsedData.music_control);
                    }

                    // 【新增】：如果正在一起听歌，将 AI 的回复显示为弹幕
                    if (typeof window.currentListenTogetherCharId !== 'undefined' && window.currentListenTogetherCharId === targetCharId) {
                        // 提取纯文本回复
                        let aiText = "";
                        if (parsedData.messages) {
                            let msgs = Array.isArray(parsedData.messages) ? parsedData.messages : [parsedData.messages];
                            aiText = msgs.filter(m => m.type === 'text').map(m => m.content).join(' ');
                        } else if (parsedData.content) {
                            aiText = parsedData.content;
                        }
                        if (aiText && typeof showMusicLiveMessage === 'function') {
                            showMusicLiveMessage('char', aiText);
                        }
                    }

                    // 处理 AI 互动朋友圈
                    if (parsedData.moment_interactions && Array.isArray(parsedData.moment_interactions)) {
                        parsedData.moment_interactions.forEach(interaction => {
                            const m = allMoments.find(x => x.id === interaction.momentId);
                            if (m) {
                                if (interaction.action === 'like') {
                                    if (!m.likes) m.likes = [];
                                    if (!m.likes.includes(targetCharId)) m.likes.push(targetCharId);
                                    momentsUpdated = true;
                                } else if (interaction.action === 'comment' && interaction.content) {
                                    if (!m.comments) m.comments = [];
                                    m.comments.push({
                                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                        authorId: targetCharId,
                                        content: interaction.content
                                    });
                                    momentsUpdated = true;
                                }
                            }
                        });
                    }

                    if (momentsUpdated) {
                        ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(allMoments));
                        if (document.getElementById('tab-moment').style.display === 'flex') {
                            renderMoments();
                        }
                    }
                } catch (e) {
                    console.warn("朋友圈 JSON 解析失败，跳过朋友圈互动", e);
                }
            }
        }).catch(e => console.warn("拦截响应失败", e));

        return response;
    };

    await _originalGenerateApiReply(isProactive, proactiveCharId);
    window.fetch = originalFetch;
    
    let newHistory = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
    let modified = false;
    
    newHistory.forEach(msg => {
        if (msg.role === 'char' && msg.content && msg.content.includes('"type":"family_card_gift"')) {
            try {
                let parsed = JSON.parse(msg.content);
                msg.type = 'family_card'; msg.subType = 'gift';
                msg.limit = parsed.limit || '1000.00';
                msg.status = 'pending'; msg.content = '[赠送亲属卡]';
                modified = true;
                for (let j = newHistory.length - 1; j >= 0; j--) {
                    if (newHistory[j].role === 'user' && newHistory[j].type === 'family_card' && newHistory[j].subType === 'request' && newHistory[j].status === 'pending') {
                        newHistory[j].status = 'received'; break;
                    }
                }
            } catch(e){}
        } else if (msg.role === 'char' && msg.content && msg.content.includes('"type":"family_card_request"')) {
            try {
                msg.type = 'family_card'; msg.subType = 'request';
                msg.status = 'pending'; msg.content = '[索要亲属卡]';
                modified = true;
            } catch(e){}
        } else if (msg.role === 'char' && msg.content && msg.content.includes('"type":"family_card_action"')) {
            try {
                let parsed = JSON.parse(msg.content);
                for (let j = newHistory.length - 1; j >= 0; j--) {
                    if (newHistory[j].role === 'user' && newHistory[j].type === 'family_card' && newHistory[j].status === 'pending') {
                        newHistory[j].status = parsed.action === 'rejected' ? 'rejected' : 'received';
                        if (newHistory[j].subType === 'gift' && newHistory[j].status === 'received') {
                            ChatDB.setItem(`family_card_gifted_${currentLoginId}_${targetCharId}`, JSON.stringify({ limit: parseFloat(newHistory[j].limit) }));
                        }
                        modified = true; break;
                    }
                }
                msg.content = parsed.content || '';
            } catch(e){}
        } else if (msg.role === 'char' && msg.content && msg.content.includes('"type":"music_invite_action"')) {
            try {
                let parsed = JSON.parse(msg.content);
                for (let j = newHistory.length - 1; j >= 0; j--) {
                    if (newHistory[j].role === 'user' && newHistory[j].type === 'music_invite' && newHistory[j].status === 'pending') {
                        newHistory[j].status = parsed.action === 'accept' ? 'accepted' : 'rejected';
                        modified = true;
                        if (parsed.action === 'accept') {
                            setTimeout(() => {
                                if (typeof window.startListenTogether === 'function') window.startListenTogether(targetCharId);
                            }, 500);
                        }
                        break;
                    }
                }
                msg.content = parsed.content || '';
            } catch(e){}
        } else if (msg.role === 'char' && msg.content && msg.content.includes('"type":"music_invite_proactive"')) {
            try {
                let parsed = JSON.parse(msg.content);
                msg.content = parsed.content || '';
                
                // 【新增】：选歌逻辑
                let songToPlay = null;
                // 1. 优先找 Char 的专属歌单
                let charPls = JSON.parse(ChatDB.getItem(`music_playlists_${targetCharId}`) || '[]');
                if (charPls.length > 0 && charPls[0].tracks && charPls[0].tracks.length > 0) {
                    let tracks = charPls[0].tracks;
                    songToPlay = tracks[Math.floor(Math.random() * tracks.length)];
                } else {
                    // 2. 如果没有，找 User 的歌单
                    let userPls = JSON.parse(ChatDB.getItem(`music_playlists_${currentLoginId}`) || '[]');
                    if (userPls.length > 0 && userPls[0].tracks && userPls[0].tracks.length > 0) {
                        let tracks = userPls[0].tracks;
                        songToPlay = tracks[Math.floor(Math.random() * tracks.length)];
                    }
                }
                // 存入全局变量，等待用户同意后播放
                window.pendingInviteSong = songToPlay;
                
                setTimeout(() => {
                    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
                    const char = chars.find(c => c.id === targetCharId);
                    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
                    const me = accounts.find(a => a.id === currentLoginId);
                    
                    if (char) {
                        document.getElementById('inviteModalCharAvatar').style.backgroundImage = `url('${char.avatarUrl || ''}')`;
                        document.getElementById('inviteModalCharName').innerText = char.netName || char.name;
                        document.getElementById('inviteModalUserAvatar').style.backgroundImage = `url('${me ? me.avatarUrl : ''}')`;
                        
                        window.currentListenTogetherCharId = targetCharId;
                        document.getElementById('musicInviteModalOverlay').classList.add('show');
                    }
                }, 1000);
            } catch(e){}
        }
    });
    
    if (modified) {
        ChatDB.setItem(`chat_history_${currentLoginId}_${targetCharId}`, JSON.stringify(newHistory));
        if (targetCharId === currentChatRoomCharId) {
            renderChatHistory(currentChatRoomCharId);
        }
    }
};

// ==========================================
// Chat APP 专属设置、安全管理与主题逻辑
// ==========================================

// 1. 设置主面板开关
function openChatAppSettingsPanel() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert('请先登录！');
    
    // 核心修改：从所有实体中查找，兼容 Char 登录
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === currentLoginId);
    
    if (account) {
        document.getElementById('payPassStatusText').innerText = account.payPassword ? '已设置' : '未设置';
        document.getElementById('freePayToggle').checked = account.freePay === true;
    }
    
    // 同步关联账号开关状态
    const linkedEnabled = ChatDB.getItem(`linked_account_enabled_${currentLoginId}`) === 'true';
    const toggle = document.getElementById('toggleLinkedAccount');
    if (toggle) toggle.checked = linkedEnabled;

    document.getElementById('chatAppSettingsPanel').style.display = 'flex';
}

// 切换免密支付
function toggleFreePay(el) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const idx = accounts.findIndex(a => a.id === currentLoginId);
    if (idx !== -1) {
        if (el.checked && !accounts[idx].payPassword) {
            alert('请先设置支付密码！');
            el.checked = false;
            return;
        }
        accounts[idx].freePay = el.checked;
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
    }
}

// 注销当前账号
function deleteCurrentAccount() {
    if (confirm('警告：注销账号将永久删除该账号信息，不可恢复！\n确定要注销吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        accounts = accounts.filter(a => a.id !== currentLoginId);
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
        ChatDB.removeItem('current_login_account');
        
        alert('账号已注销！');
        closeChatAppSettingsPanel();
        document.getElementById('wechatPanel').style.display = 'none';
        document.getElementById('chatPanel').style.display = 'flex';
        switchChatMode('login');
    }
}
function closeChatAppSettingsPanel() { document.getElementById('chatAppSettingsPanel').style.display = 'none'; }

// 2. 登录密码修改逻辑
function openModifyPasswordPanel() {
    document.getElementById('oldPassInput').value = '';
    document.getElementById('newPassInput1').value = '';
    document.getElementById('newPassInput2').value = '';
    document.getElementById('chatModifyPasswordPanel').style.display = 'flex';
}
function closeModifyPasswordPanel() { document.getElementById('chatModifyPasswordPanel').style.display = 'none'; }

function executeModifyPassword() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let isUser = true;
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    let idx = accounts.findIndex(a => a.id === currentLoginId);
    
    // 核心修改：如果在用户库找不到，去角色库找
    if (idx === -1) {
        isUser = false;
        accounts = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        idx = accounts.findIndex(a => a.id === currentLoginId);
    }
    
    if (idx === -1) return alert('账号不存在！');
    const account = accounts[idx];

    const oldP = document.getElementById('oldPassInput').value.trim();
    const n1 = document.getElementById('newPassInput1').value.trim();
    const n2 = document.getElementById('newPassInput2').value.trim();

    if (!oldP || !n1 || !n2) return alert('请填写完整！');
    if (oldP !== account.password) return alert('旧密码错误！');
    if (oldP === n1) return alert('旧密码不能和新密码一样！');
    if (n1 !== n2) return alert('两次输入的新密码不一致！');

    accounts[idx].password = n1;
    
    // 根据身份存入对应的数据库
    if (isUser) {
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
    } else {
        ChatDB.setItem('chat_chars', JSON.stringify(accounts));
    }
    
    alert('登录密码修改成功！');
    closeModifyPasswordPanel();
}

// 3. 支付密码管理逻辑 (首次设置 vs 修改)
function openModifyPayPasswordPanel() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === currentLoginId);

    const isFirstTime = !account.payPassword;
    document.getElementById('payPassTitle').innerText = isFirstTime ? '设置支付密码' : '修改支付密码';
    document.getElementById('payOldPassSection').style.display = isFirstTime ? 'none' : 'block';
    document.getElementById('payForgetHint').style.display = isFirstTime ? 'none' : 'flex';
    
    document.getElementById('oldPayPassInput').value = '';
    document.getElementById('newPayPassInput1').value = '';
    document.getElementById('newPayPassInput2').value = '';
    document.getElementById('chatModifyPayPasswordPanel').style.display = 'flex';
}
function closeModifyPayPasswordPanel() { document.getElementById('chatModifyPayPasswordPanel').style.display = 'none'; }

function executeModifyPayPassword() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let isUser = true;
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    let idx = accounts.findIndex(a => a.id === currentLoginId);
    
    if (idx === -1) {
        isUser = false;
        accounts = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        idx = accounts.findIndex(a => a.id === currentLoginId);
    }
    const account = accounts[idx];

    const oldP = document.getElementById('oldPayPassInput').value.trim();
    const n1 = document.getElementById('newPayPassInput1').value.trim();
    const n2 = document.getElementById('newPayPassInput2').value.trim();

    if (!n1 || !n2) return alert('请填写新密码！');
    if (!/^\d{6}$/.test(n1)) return alert('支付密码必须是6位数字！');

    if (account.payPassword) {
        // 修改模式
        if (oldP !== account.payPassword) return alert('旧支付密码错误！');
        if (oldP === n1) return alert('旧密码不能和新密码一样！');
    }

    if (n1 !== n2) return alert('两次输入不一致！');

    accounts[idx].payPassword = n1;
    if (isUser) {
        ChatDB.setItem('chat_accounts', JSON.stringify(accounts));
    } else {
        ChatDB.setItem('chat_chars', JSON.stringify(accounts));
    }
    alert('支付密码设置成功！');
    document.getElementById('payPassStatusText').innerText = '已设置';
    closeModifyPayPasswordPanel();
}

// 忘记密码找回
function showOldPasswordHint(type) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    // 核心修改：从所有实体中查找，防止 Char 登录时 account 为 undefined
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === currentLoginId);
    
    if (!account) return alert('未找到账号信息！');
    
    if (type === 'login') alert(`您的登录密码是：${account.password || '未设置'}`);
    else alert(`您的支付密码是：${account.payPassword || '未设置'}`);
}

// 4. 个性化主题逻辑
function openChatThemeSettingsPanel() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    document.getElementById('chatThemeCssInput').value = ChatDB.getItem(`chat_theme_css_${currentLoginId}`) || '';
    document.getElementById('chatThemeSettingsPanel').style.display = 'flex';
}
function closeChatThemeSettingsPanel() { document.getElementById('chatThemeSettingsPanel').style.display = 'none'; }

function applyChatThemeCss() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const css = document.getElementById('chatThemeCssInput').value;
    let styleTag = document.getElementById('chat-custom-theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'chat-custom-theme-style';
        document.head.appendChild(styleTag);
    }
    // 限制作用域在 wechatPanel 内
    styleTag.innerHTML = css.trim() ? `#wechatPanel { ${css} }` : '';
}

function saveChatThemeSettings() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const css = document.getElementById('chatThemeCssInput').value;
    ChatDB.setItem(`chat_theme_css_${currentLoginId}`, css);
    applyChatThemeCss();
    alert('主题设置已保存！');
    closeChatThemeSettingsPanel();
}

// 预设库逻辑
function saveChatThemePreset() {
    const css = document.getElementById('chatThemeCssInput').value.trim();
    if (!css) return alert('内容为空！');
    openGlobalPrompt('保存预设', '请输入预设名称', '⸝⸝⸝ ╸▵╺⸝⸝⸝', (name) => {
        if (name && name.trim()) {
            let ps = JSON.parse(ChatDB.getItem('chat_theme_presets') || '[]');
            ps.push({ id: Date.now().toString(), name: name.trim(), css: css });
            ChatDB.setItem('chat_theme_presets', JSON.stringify(ps));
            alert('已存入预设库');
        }
    });
}

function openChatThemePresetModal() {
    const listEl = document.getElementById('chatThemePresetList');
    listEl.innerHTML = '';
    let ps = JSON.parse(ChatDB.getItem('chat_theme_presets') || '[]');
    if (ps.length === 0) listEl.innerHTML = '<div style="text-align:center;color:#aaa;font-size:12px;">暂无预设</div>';
    ps.forEach(p => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#f9f9f9;padding:12px;border-radius:10px;';
        item.innerHTML = `<span style="cursor:pointer;flex:1;font-weight:bold;" onclick="loadChatThemePreset('${p.id}')">${p.name}</span><span style="color:red;cursor:pointer;padding:0 5px;" onclick="deleteChatThemePreset('${p.id}')">×</span>`;
        listEl.appendChild(item);
    });
    document.getElementById('chatThemePresetModalOverlay').classList.add('show');
}
function closeChatThemePresetModal() { document.getElementById('chatThemePresetModalOverlay').classList.remove('show'); }
function loadChatThemePreset(id) {
    let ps = JSON.parse(ChatDB.getItem('chat_theme_presets') || '[]');
    const p = ps.find(x => x.id === id);
    if (p) { document.getElementById('chatThemeCssInput').value = p.css; applyChatThemeCss(); closeChatThemePresetModal(); }
}
function deleteChatThemePreset(id) {
    if (confirm('删除？')) {
        let ps = JSON.parse(ChatDB.getItem('chat_theme_presets') || '[]');
        ChatDB.setItem('chat_theme_presets', JSON.stringify(ps.filter(x => x.id !== id)));
        openChatThemePresetModal();
    }
}

// 自动加载主题与朋友圈配置
window.addEventListener('ChatDBReady', () => {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (currentLoginId) {
        // 1. 加载自定义主题 CSS
        const savedCss = ChatDB.getItem(`chat_theme_css_${currentLoginId}`);
        if (savedCss) {
            let styleTag = document.getElementById('chat-custom-theme-style') || document.createElement('style');
            styleTag.id = 'chat-custom-theme-style';
            document.head.appendChild(styleTag);
            styleTag.innerHTML = `#wechatPanel { ${savedCss} }`;
        }

        // 2. 【核心修复】：无论是否在朋友圈页，只要数据库好了就渲染一次
        // 这样可以确保背景、头像和动态列表在内存中准备就绪
        renderMoments();
    }
});
;
// 页面加载时初始化表情包分组 (等待数据库就绪)
window.addEventListener('ChatDBReady', () => {
    emojiGroups = JSON.parse(ChatDB.getItem('chat_emoji_groups') || '["默认分组"]');
});

// ==========================================
// 主动发消息后台检测逻辑
// ==========================================
setInterval(() => {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    const now = Date.now();

    sessions.forEach(charId => {
        const isActiveEnabled = ChatDB.getItem(`chat_active_msg_${charId}`) === 'true';
        if (!isActiveEnabled) return;

        const intervalMinutes = parseInt(ChatDB.getItem(`chat_active_msg_interval_${charId}`)) || 60;
        const intervalMs = intervalMinutes * 60 * 1000;

        let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
        if (history.length === 0) return;

        const lastMsg = history[history.length - 1];
        
        // 距离最后一条消息超过了设定的间隔时间
        if (now - lastMsg.timestamp >= intervalMs) {
            const lastProactiveTime = parseInt(ChatDB.getItem(`last_proactive_time_${currentLoginId}_${charId}`) || '0');
            // 确保距离上次主动触发也超过了间隔时间，防止频繁触发
            if (now - lastProactiveTime >= intervalMs) {
                ChatDB.setItem(`last_proactive_time_${currentLoginId}_${charId}`, now.toString());
                // 触发主动发消息
                generateApiReply(true, charId);
            }
        }
    });
}, 60000); // 每分钟检查一次

// ==========================================
// 应用内消息通知弹窗逻辑
// ==========================================
let notifTimeout;
let currentNotifCharId = null;

function showMsgNotification(charId, content) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === charId);
    if (!char) return;

    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    const displayName = remarks[charId] || char.netName || char.name;

    let cleanContent = content.replace(/<[^>]+>/g, '');
    if (content.includes('<img') || content.includes('chat-img-120') || content.includes('chat-desc-img-120')) cleanContent = '[图片/表情包]';
    if (content.includes('[转账]')) cleanContent = '[转账]';
    if (content.includes('[赠送亲属卡]') || content.includes('[索要亲属卡]')) cleanContent = '[亲属卡]';

    // 1. 触发应用内顶部弹窗
    document.getElementById('notifAvatar').style.backgroundImage = `url('${char.avatarUrl || ''}')`;
    document.getElementById('notifName').innerText = displayName;
    document.getElementById('notifDesc').innerText = cleanContent;

    currentNotifCharId = charId;

    const notifEl = document.getElementById('inAppNotification');
    notifEl.classList.remove('show');
    
    // 强制重绘以重新触发动画
    void notifEl.offsetWidth; 
    
    notifEl.classList.add('show');

    clearTimeout(notifTimeout);
    notifTimeout = setTimeout(() => {
        notifEl.classList.remove('show');
    }, 4000);

    // 2. 播放提示音
    const soundUrl = ChatDB.getItem('sys_notif_sound');
    if (soundUrl) {
        const audio = new Audio(soundUrl);
        audio.play().catch(e => console.log("自动播放提示音被拦截:", e));
    }

    // 3. 触发系统级通知 (融合真实浏览器通知逻辑)
    const notifMode = ChatDB.getItem('sys_notif_mode') || 'off';
    
    // 兼容 script.js 中的全局变量
    const isRealNotifEnabled = localStorage.getItem('ios_theme_real_notif_enabled') === 'true';
    const isAlwaysRealNotifEnabled = localStorage.getItem('ios_theme_always_real_notif_enabled') === 'true';

    let shouldSend = false;

    // 判断是否需要发送通知 (结合 chat.js 的 notifMode 和 script.js 的全局开关)
    if (notifMode === 'always' || isAlwaysRealNotifEnabled) {
        shouldSend = true;
    } else if (notifMode === 'background' || isRealNotifEnabled) {
        if (document.hidden || document.visibilityState !== 'visible') {
            shouldSend = true;
        }
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const finalBody = `[${timeStr}] ${cleanContent}`;

    if (shouldSend && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(function(registration) {
            registration.showNotification(displayName, {
                body: finalBody,
                icon: char.avatarUrl || 'https://i.postimg.cc/1RGRdT9k/IMG-20260427-175620.png',
                badge: char.avatarUrl || 'https://i.postimg.cc/1RGRdT9k/IMG-20260427-175620.png',
                image: char.avatarUrl || '',
                timestamp: Date.now(),
                vibrate: [200, 100, 200],
                tag: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                renotify: true
            });
        }).catch(err => {
            // 降级处理：如果 serviceWorker 不可用，使用普通 Notification
            const sysNotif = new Notification(displayName, {
                body: finalBody,
                icon: char.avatarUrl || 'https://i.postimg.cc/1RGRdT9k/IMG-20260427-175620.png',
                timestamp: Date.now()
            });
            sysNotif.onclick = function() {
                window.focus();
                handleNotificationClick();
                sysNotif.close();
            };
        });
    }
}

function handleNotificationClick() {
    const notifEl = document.getElementById('inAppNotification');
    notifEl.classList.remove('show');
    if (currentNotifCharId) {
        // 1. 强制关闭所有可能遮挡的全屏面板（如设置、角色库、个人主页等）
        document.querySelectorAll('.theme-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // 2. 确保微信主面板显示
        document.getElementById('wechatPanel').style.display = 'flex';
        
        // 3. 切换到底部的“Chat(聊天列表)” Tab
        switchWechatTab('chat');
        
        // 4. 直接打开该角色的全屏聊天室
        openChatRoom(currentNotifCharId);
    }
}
// 辅助函数：获取当前登录账号绑定的面具ID
function getCurrentPersonaIdForMemory() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return null;
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    return account ? account.personaId : currentLoginId;
}

function openMemoryPanel() {
    if (!currentProfileCharId) return;
    initMemoryData(currentProfileCharId);
    
    // 填充头部角色信息
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentProfileCharId);
    if (char) {
        const avatarEl = document.getElementById('memoryCharAvatar');
        if (avatarEl) avatarEl.style.backgroundImage = `url('${char.avatarUrl || ''}')`;
        const nameEl = document.getElementById('memoryCharName');
        if (nameEl) nameEl.innerText = char.netName || char.name || '未命名';
    }
    
    document.getElementById('charMemoryPanel').style.display = 'flex';
    switchMemoryTab('summary'); // 默认打开总结 Tab
}

function closeMemoryPanel() {
    document.getElementById('charMemoryPanel').style.display = 'none';
}

function initMemoryData(charId) {
    const personaId = getCurrentPersonaIdForMemory();
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${charId}`) || 'null');
    if (!memory) {
        memory = {
            summary: [],
            core: [],
            note: [],
            settings: { autoSummarize: false, autoTurns: 10, customPrompt: '' }
        };
        ChatDB.setItem(`char_memory_${personaId}_${charId}`, JSON.stringify(memory));
    }
}

function switchMemoryTab(tab) {
    currentMemoryTab = tab;
    document.querySelectorAll('.memory-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`memTab-${tab}`).classList.add('active');
    renderMemoryContent();
}

function renderMemoryContent() {
    const personaId = getCurrentPersonaIdForMemory();
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
    const list = memory[currentMemoryTab] || [];
    const container = document.getElementById('memoryContentArea');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#aaa; font-size:12px; margin-top:40px;">暂无记忆内容</div>';
        return;
    }

    let titleMap = {
        'summary': { title: 'CHAT SUMMARY', sub: '(对话总结)' },
        'core': { title: 'CORE MEMORY', sub: '(核心记忆)' },
        'note': { title: 'AUTHOR NOTE', sub: '(作者备注)' }
    };

    list.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = 'memory-step-block';
        if (index === 0) block.classList.add('expanded'); 
        
        block.innerHTML = `
            <div class="memory-fold-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div>
                    <div class="memory-step-title">Step-${index + 1}</div>
                    <div class="memory-step-subtitle">${titleMap[currentMemoryTab].title} <span>${titleMap[currentMemoryTab].sub}</span></div>
                </div>
                <svg class="memory-fold-arrow" viewBox="0 0 24 24" width="20" height="20" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="memory-fold-content">
                <div class="memory-step-content">
                    <p>${item.content.replace(/\n/g, '</p><p>')}</p>
                </div>
                <div class="memory-action-btns">
                    <svg onclick="editMemoryEntry('${item.id}')" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <svg onclick="deleteMemoryEntry('${item.id}')" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </div>
            </div>
        `;
        container.appendChild(block);
    });
}

function openMemoryEditModal(id = null) {
    document.getElementById('memoryEditType').value = currentMemoryTab;
    if (id) {
        document.getElementById('memoryEditTitle').innerText = '编辑记忆';
        document.getElementById('memoryEditId').value = id;
        const personaId = getCurrentPersonaIdForMemory();
        let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
        const item = memory[currentMemoryTab].find(m => m.id === id);
        if (item) document.getElementById('memoryEditText').value = item.content;
    } else {
        document.getElementById('memoryEditTitle').innerText = '添加记忆';
        document.getElementById('memoryEditId').value = '';
        document.getElementById('memoryEditText').value = '';
    }
    document.getElementById('memoryEditModalOverlay').classList.add('show');
}

function closeMemoryEditModal() {
    document.getElementById('memoryEditModalOverlay').classList.remove('show');
}

function editMemoryEntry(id) {
    openMemoryEditModal(id);
}

function saveMemoryEntry() {
    const type = document.getElementById('memoryEditType').value;
    const content = document.getElementById('memoryEditText').value.trim();
    const id = document.getElementById('memoryEditId').value;
    
    if (!content) return alert('内容不能为空！');

    const personaId = getCurrentPersonaIdForMemory();
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
    
    if (id) {
        const index = memory[type].findIndex(m => m.id === id);
        if (index !== -1) memory[type][index].content = content;
    } else {
        memory[type].push({ id: Date.now().toString(), content: content });
    }

    ChatDB.setItem(`char_memory_${personaId}_${currentProfileCharId}`, JSON.stringify(memory));
    closeMemoryEditModal();
    if (type === currentMemoryTab) renderMemoryContent();
}

function deleteMemoryEntry(id) {
    if (confirm('确定删除这条记忆吗？')) {
        const personaId = getCurrentPersonaIdForMemory();
        let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
        memory[currentMemoryTab] = memory[currentMemoryTab].filter(m => m.id !== id);
        ChatDB.setItem(`char_memory_${personaId}_${currentProfileCharId}`, JSON.stringify(memory));
        renderMemoryContent();
    }
}

function openMemorySettingsModal() {
    const personaId = getCurrentPersonaIdForMemory();
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
    
    document.getElementById('memAutoToggle').checked = memory.settings.autoSummarize || false;
    document.getElementById('memAutoTurns').value = memory.settings.autoTurns || 10;
    document.getElementById('memCustomPrompt').value = memory.settings.customPrompt || '';
    
    document.getElementById('memorySettingsModalOverlay').classList.add('show');
}

function closeMemorySettingsModal() {
    const personaId = getCurrentPersonaIdForMemory();
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
    
    if (!memory.settings) memory.settings = {};
    memory.settings.autoSummarize = document.getElementById('memAutoToggle').checked;
    memory.settings.autoTurns = parseInt(document.getElementById('memAutoTurns').value) || 10;
    memory.settings.customPrompt = document.getElementById('memCustomPrompt').value.trim();
    
    ChatDB.setItem(`char_memory_${personaId}_${currentProfileCharId}`, JSON.stringify(memory));
    document.getElementById('memorySettingsModalOverlay').classList.remove('show');
}

async function executeManualSummary() {
    const start = parseInt(document.getElementById('memManualStart').value);
    const end = parseInt(document.getElementById('memManualEnd').value);
    if (!start || !end || start > end) return alert('请输入正确的起始和结束轮数！');
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentProfileCharId) return;

    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) {
        return alert('请先在设置中配置 API 信息！');
    }

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentProfileCharId}`) || '[]');
    if (history.length === 0) return alert('暂无聊天记录可总结！');
    
    const startIndex = Math.max(0, history.length - end * 2);
    const endIndex = history.length - (start - 1) * 2;
    const targetHistory = history.slice(startIndex, endIndex);
    
    let chatText = targetHistory.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`).join('\n');

    const personaId = getCurrentPersonaIdForMemory();
    let memory = JSON.parse(ChatDB.getItem(`char_memory_${personaId}_${currentProfileCharId}`) || '{}');
    if (!memory.summary) memory.summary = [];
    let oldSummary = memory.summary.length > 0 ? memory.summary[0].content : "暂无前情提要。";
    let customPrompt = (memory.settings && memory.settings.customPrompt) ? memory.settings.customPrompt : "1. 使用第三人称陈述句，保持客观、简短。\n2. 重点记录发生的关键事件、角色之间关系的改变、以及重要的新情报。\n3. 剥离废话，只输出总结的文本，不要输出任何其他格式或多余的解释。";

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentProfileCharId);
    const charDesc = char ? (char.description || '无') : '无';

    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? (persona.persona || '无') : '无';

    const summaryPrompt = `你是一个故事记录者。请根据以下信息，更新现有的故事总结。

【角色设定】：
${charDesc}

【用户设定】：
${userDesc}

【旧的故事总结】：
${oldSummary}

【最新的聊天记录】：
${chatText}

【总结要求】：
${customPrompt}

请输出更新后的【新的故事总结】：`;

    document.getElementById('memorySettingsModalOverlay').classList.remove('show');
    showToast('正在生成记忆总结...', 'loading');
    
    try {
        const response = await fetch(`${apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: 'user', content: summaryPrompt }],
                temperature: 0.5
            })
        });

        if (response.ok) {
            const data = await response.json();
            const newSummaryText = data.choices[0].message.content.trim();
            
            memory.summary = [{ id: Date.now().toString(), content: newSummaryText }];
            ChatDB.setItem(`char_memory_${personaId}_${currentProfileCharId}`, JSON.stringify(memory));
            
            hideToast();
            showToast('总结完成！', 'success', 2000);
            
            if (currentMemoryTab === 'summary') renderMemoryContent();
        } else {
            const err = await response.json();
            hideToast();
            showApiErrorModal(JSON.stringify(err, null, 2));
        }
    } catch (e) {
        hideToast();
        showApiErrorModal(e.message || '网络请求失败，请检查 API 地址或网络连接。');
    }
}
// ==========================================
// 全局 UI 辅助函数 (Toast & Error Modal)
// ==========================================
let toastTimeout;

function showToast(message, type = 'loading', duration = 0) {
    const toast = document.getElementById('globalToast');
    const iconContainer = document.getElementById('toastIcon');
    const textContainer = document.getElementById('toastText');

    textContainer.innerText = message;

    if (type === 'loading') {
        iconContainer.innerHTML = '<div class="toast-spinner"></div>';
    } else if (type === 'success') {
        iconContainer.innerHTML = '<svg class="toast-success-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else {
        iconContainer.innerHTML = '';
    }

    toast.classList.add('show');

    clearTimeout(toastTimeout);
    if (duration > 0) {
        toastTimeout = setTimeout(() => {
            hideToast();
        }, duration);
    }
}

function hideToast() {
    const toast = document.getElementById('globalToast');
    toast.classList.remove('show');
}

function showApiErrorModal(errorMessage) {
    document.getElementById('apiErrorTextarea').value = errorMessage;
    document.getElementById('apiErrorModalOverlay').classList.add('show');
}

function closeApiErrorModal() {
    document.getElementById('apiErrorModalOverlay').classList.remove('show');
}

function copyApiErrorText() {
    const textarea = document.getElementById('apiErrorTextarea');
    textarea.select();
    textarea.setSelectionRange(0, 99999); // 兼容移动端
    try {
        document.execCommand('copy');
        alert('报错内容已复制到剪贴板！');
    } catch (err) {
        alert('复制失败，请手动长按复制。');
    }
}

// 通用文本复制函数
function copyTextToClipboard(text) {
    if (!text || text === '未生成') {
        return alert('暂无内容可复制');
    }
    
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('复制成功', 'success', 1500);
        }).catch(err => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

// 兼容旧版浏览器的复制方案
function fallbackCopyTextToClipboard(text) {
    let textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('复制成功', 'success', 1500);
    } catch (err) {
        alert('复制失败，请手动长按复制');
    }
    textArea.remove();
}

// ==========================================
// 心声历史记录逻辑
// ==========================================
function openInnerVoiceHistoryPanel() {
    document.getElementById('innerVoiceHistoryPanel').style.display = 'flex';
    renderInnerVoiceHistory();
}

function closeInnerVoiceHistoryPanel() {
    document.getElementById('innerVoiceHistoryPanel').style.display = 'none';
}

function renderInnerVoiceHistory() {
    const listEl = document.getElementById('innerVoiceHistoryList');
    listEl.innerHTML = '';
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;
    
    let ivHistory = JSON.parse(ChatDB.getItem(`inner_voice_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    
    if (ivHistory.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">暂无心声记录</div>';
        return;
    }
    
    ivHistory.forEach((iv, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'background: #fff; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #eee; position: relative;';
        
        const date = new Date(iv.timestamp);
        const timeStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        
        item.innerHTML = `
            <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">${timeStr}</div>
            <div style="font-size: 14px; color: #333; line-height: 1.5; word-break: break-all;">${iv.content}</div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid #f5f5f5; padding-top: 10px;">
                <div onclick="openEditInnerVoiceModal('${iv.id}')" style="font-size: 12px; color: #576b95; cursor: pointer; font-weight: bold;">编辑</div>
                <div onclick="deleteInnerVoice('${iv.id}')" style="font-size: 12px; color: #ff3b30; cursor: pointer; font-weight: bold;">删除</div>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function openEditInnerVoiceModal(id) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let ivHistory = JSON.parse(ChatDB.getItem(`inner_voice_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const iv = ivHistory.find(i => i.id === id);
    
    if (iv) {
        document.getElementById('editInnerVoiceId').value = id;
        document.getElementById('editInnerVoiceTextarea').value = iv.content;
        document.getElementById('editInnerVoiceModalOverlay').classList.add('show');
    }
}

function closeEditInnerVoiceModal() {
    document.getElementById('editInnerVoiceModalOverlay').classList.remove('show');
}

function saveEditedInnerVoice() {
    const id = document.getElementById('editInnerVoiceId').value;
    const newText = document.getElementById('editInnerVoiceTextarea').value.trim();
    
    if (!newText) return alert('心声内容不能为空！');
    
    const currentLoginId = ChatDB.getItem('current_login_account');
    let ivHistory = JSON.parse(ChatDB.getItem(`inner_voice_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    
    const index = ivHistory.findIndex(i => i.id === id);
    if (index !== -1) {
        ivHistory[index].content = newText;
        ChatDB.setItem(`inner_voice_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(ivHistory));
        
        if (index === ivHistory.length - 1) {
            ChatDB.setItem(`last_inner_voice_${currentChatRoomCharId}`, newText);
        }
        
        renderInnerVoiceHistory();
        closeEditInnerVoiceModal();
    }
}

function deleteInnerVoice(id) {
    if (confirm('确定删除这条心声记录吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let ivHistory = JSON.parse(ChatDB.getItem(`inner_voice_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
        
        const index = ivHistory.findIndex(i => i.id === id);
        if (index !== -1) {
            ivHistory.splice(index, 1);
            ChatDB.setItem(`inner_voice_history_${currentLoginId}_${currentChatRoomCharId}`, JSON.stringify(ivHistory));
            
            if (ivHistory.length > 0) {
                ChatDB.setItem(`last_inner_voice_${currentChatRoomCharId}`, ivHistory[ivHistory.length - 1].content);
            } else {
                ChatDB.removeItem(`last_inner_voice_${currentChatRoomCharId}`);
            }
            
            renderInnerVoiceHistory();
        }
    }
}
// ==========================================
// 朋友圈 (Moment) 核心逻辑 (含分组与 API 融合)
// ==========================================

// 1. 封面背景上传
function triggerMomentCoverUpload() {
    document.getElementById('momentCoverInput').click();
}

function handleMomentCoverUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        if (currentLoginId) {
            ChatDB.setItem(`moment_cover_${currentLoginId}`, e.target.result);
            renderMoments();
        }
    }
    reader.readAsDataURL(file);
    event.target.value = '';
}

// 渲染朋友圈主页 (增强持久化与同步)
function renderMoments() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    // 核心修改：兼容 Char 视角
    let allEntities = getAllEntities();
    const me = allEntities.find(a => a.id === currentLoginId);
    if (!me) return;

    // 【同步头像与名字】：确保跟随用户最新资料
    const meNameEl = document.getElementById('momentMeName');
    const meAvatarEl = document.getElementById('momentMeAvatar');
    if (meNameEl) meNameEl.innerText = me.netName || '我';
    if (meAvatarEl) meAvatarEl.style.backgroundImage = `url('${me.avatarUrl || ''}')`;

    // 【修复背景持久化】：从数据库读取封面
    const coverImgEl = document.getElementById('momentCoverImg');
    const savedCover = ChatDB.getItem(`moment_cover_${currentLoginId}`);
    if (coverImgEl) {
        if (savedCover) {
            coverImgEl.style.backgroundImage = `url('${savedCover}')`;
        } else {
            coverImgEl.style.backgroundImage = ''; // 没设置时显示默认深色背景
            coverImgEl.style.backgroundColor = '#333';
        }
    }

    const container = document.getElementById('momentListContainer');
    if (!container) return;
    container.innerHTML = '';

    let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
    let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');

    if (moments.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; padding: 40px 0;">暂无朋友圈动态</div>';
        return;
    }

    // 倒序渲染（最新的在上面）
    moments.slice().reverse().forEach(moment => {
        let authorName = '未知';
        let authorAvatar = '';
        let isMe = moment.authorId === currentLoginId;

        if (isMe) {
            authorName = me.netName;
            authorAvatar = me.avatarUrl;
        } else {
            const char = allChars.find(c => c.id === moment.authorId);
            if (char) {
                authorName = remarks[char.id] || char.netName || char.name;
                authorAvatar = char.avatarUrl;
            }
        }

        // 格式化时间
        const date = new Date(moment.timestamp);
        const timeStr = `${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

        // 渲染图片区域
        let imagesHtml = '';
        if (moment.images && moment.images.length > 0) {
            imagesHtml = '<div class="moment-images">';
            moment.images.forEach(img => {
                if (img.type === 'real') {
                    const imgTag = `<img src="${img.url}">`;
                    imagesHtml += `<img src="${img.url}" class="moment-img-real" onclick="openMomentImageDetail('${encodeURIComponent(imgTag)}')">`;
                } else if (img.type === 'desc') {
                    const descTag = `<div class="chat-desc-img-120"><div class="img-text">${img.text}</div></div>`;
                    imagesHtml += `<div class="chat-desc-img-120" onclick="openMomentImageDetail('${encodeURIComponent(descTag)}')"><div class="img-text">${img.text}</div></div>`;
                }
            });
            imagesHtml += '</div>';
        }

        // 渲染点赞和评论区
        let interactionHtml = '';
        const hasLikes = moment.likes && moment.likes.length > 0;
        const hasComments = moment.comments && moment.comments.length > 0;

        if (hasLikes || hasComments) {
            interactionHtml += '<div class="moment-interaction">';
            
            if (hasLikes) {
                const likeNames = moment.likes.map(id => {
                    if (id === currentLoginId) return me.netName;
                    const c = allChars.find(char => char.id === id);
                    return c ? (remarks[c.id] || c.netName || c.name) : '未知';
                }).join(', ');

                interactionHtml += `
                    <div class="moment-likes">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        ${likeNames}
                    </div>
                `;
            }

            if (hasComments) {
                interactionHtml += '<div class="moment-comments">';
                moment.comments.forEach(comment => {
                    let cName = '未知';
                    if (comment.authorId === currentLoginId) cName = me.netName;
                    else {
                        const c = allChars.find(char => char.id === comment.authorId);
                        if (c) cName = remarks[c.id] || c.netName || c.name;
                    }
                    interactionHtml += `
                        <div class="moment-comment-item">
                            <span class="moment-comment-user">${cName}</span>: ${comment.content}
                        </div>
                    `;
                });
                interactionHtml += '</div>';
            }
            interactionHtml += '</div>';
        }

        const isLikedByMe = moment.likes && moment.likes.includes(currentLoginId);
        const likeText = isLikedByMe ? '取消' : '赞';
        
        // 分组可见性标签
        let visibilityTag = '';
        if (isMe && moment.visibility && moment.visibility !== 'all') {
            visibilityTag = `<span style="font-size: 10px; color: #888; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">仅 ${moment.visibility} 可见</span>`;
        }

        const itemEl = document.createElement('div');
        itemEl.className = 'moment-item';
        itemEl.innerHTML = `
            <div class="moment-avatar" style="background-image: url('${authorAvatar}')"></div>
            <div class="moment-right">
                <div class="moment-name">${authorName}</div>
                <div class="moment-content">${moment.content}</div>
                ${imagesHtml}
                <div class="moment-footer">
                    <div style="display: flex; align-items: center;">
                        <span class="moment-time">${timeStr}</span>
                        ${visibilityTag}
                        ${isMe ? `<span class="moment-delete" onclick="deleteMoment('${moment.id}')">删除</span>` : ''}
                    </div>
                    <div class="item-actions">
                        <div class="moment-action-menu" id="momentMenu_${moment.id}">
                            <div class="moment-action-item" onclick="toggleMomentLike('${moment.id}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                ${likeText}
                            </div>
                            <div class="moment-action-item" onclick="openMomentCommentInput('${moment.id}')">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                评论
                            </div>
                        </div>
                        <div class="moment-action-btn" onclick="toggleMomentMenu('${moment.id}')">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="#576b95"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                        </div>
                    </div>
                </div>
                ${interactionHtml}
            </div>
        `;
        container.appendChild(itemEl);
    });
}

// 3. 朋友圈图片点击查看
function openMomentImageDetail(encodedHtml) {
    const html = decodeURIComponent(encodedHtml);
    const contentEl = document.getElementById('imageDetailContent');
    contentEl.innerHTML = '';

    if (html.includes('<img')) {
        const match = html.match(/src="([^"]+)"/);
        if (match && match[1]) {
            contentEl.innerHTML = `<img src="${match[1]}">`;
        }
    } else if (html.includes('chat-desc-img-120')) {
        const match = html.match(/<div class="img-text">([\s\S]*?)<\/div>/);
        if (match && match[1]) {
            contentEl.innerHTML = `<div class="image-detail-text-card">${match[1]}</div>`;
        }
    }
    document.getElementById('imageDetailOverlay').classList.add('show');
}

// 4. 朋友圈操作菜单 (点赞/评论)
function toggleMomentMenu(id) {
    document.querySelectorAll('.moment-action-menu').forEach(menu => {
        if (menu.id !== `momentMenu_${id}`) menu.classList.remove('show');
    });
    const menu = document.getElementById(`momentMenu_${id}`);
    menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.item-actions')) {
        document.querySelectorAll('.moment-action-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

function toggleMomentLike(momentId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
    const moment = moments.find(m => m.id === momentId);
    if (moment) {
        if (!moment.likes) moment.likes = [];
        const index = moment.likes.indexOf(currentLoginId);
        if (index > -1) moment.likes.splice(index, 1);
        else moment.likes.push(currentLoginId);
        ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(moments));
        renderMoments();
    }
}

function openMomentCommentInput(momentId) {
    document.getElementById(`momentMenu_${momentId}`).classList.remove('show');
    document.getElementById('momentCommentTargetId').value = momentId;
    document.getElementById('momentCommentInput').value = '';
    document.getElementById('momentCommentModalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('momentCommentInput').focus(), 100);
}

document.getElementById('momentCommentModalOverlay').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
});

function submitMomentComment() {
    const momentId = document.getElementById('momentCommentTargetId').value;
    const content = document.getElementById('momentCommentInput').value.trim();
    if (!content) return alert('请输入评论内容！');

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
    const moment = moments.find(m => m.id === momentId);
    if (moment) {
        if (!moment.comments) moment.comments = [];
        moment.comments.push({
            id: Date.now().toString(),
            authorId: currentLoginId,
            content: content
        });
        ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(moments));
        
        // --- 新增：触发 Char 感知系统 ---
        injectCharPerception('comment_moment', content);
        // -------------------------------

        document.getElementById('momentCommentModalOverlay').classList.remove('show');
        renderMoments();
    }
}

function deleteMoment(momentId) {
    if (confirm('确定要删除这条朋友圈吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
        moments = moments.filter(m => m.id !== momentId);
        ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(moments));
        
        // --- 新增：触发 Char 感知系统 ---
        injectCharPerception('delete_moment', '');
        // -------------------------------

        renderMoments();
    }
}

// 5. 发布朋友圈面板逻辑
let tempMomentImages = [];

function openMomentPostPanel() {
    document.getElementById('momentPostText').value = '';
    tempMomentImages = [];
    renderTempMomentImages();
    document.getElementById('momentDescInputArea').style.display = 'none';
    
    // 渲染分组选择
    const selectEl = document.getElementById('momentVisibilitySelect');
    selectEl.innerHTML = '<option value="all">公开 (所有人可见)</option>';
    const currentLoginId = ChatDB.getItem('current_login_account');
    let userGroups = JSON.parse(ChatDB.getItem(`contact_groups_${currentLoginId}`) || '["默认分组"]');
    userGroups.forEach(g => {
        selectEl.innerHTML += `<option value="${g}">仅 ${g} 可见</option>`;
    });

    document.getElementById('momentPostPanel').style.display = 'flex';
}

function closeMomentPostPanel() {
    document.getElementById('momentPostPanel').style.display = 'none';
}

function openMomentTypeModal() { document.getElementById('momentTypeModalOverlay').classList.add('show'); }
function closeMomentTypeModal() { document.getElementById('momentTypeModalOverlay').classList.remove('show'); }

function triggerMomentLocalImage() {
    closeMomentTypeModal();
    document.getElementById('momentLocalImageInput').click();
}

function handleMomentLocalImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        tempMomentImages.push({ type: 'real', url: e.target.result });
        renderTempMomentImages();
    }
    reader.readAsDataURL(file);
    event.target.value = '';
}

function triggerMomentDescImage() {
    closeMomentTypeModal();
    document.getElementById('momentDescInput').value = '';
    document.getElementById('momentDescInputArea').style.display = 'block';
    setTimeout(() => document.getElementById('momentDescInput').focus(), 100);
}

function confirmMomentDescImage() {
    const text = document.getElementById('momentDescInput').value.trim();
    if (text) {
        tempMomentImages.push({ type: 'desc', text: text });
        renderTempMomentImages();
        document.getElementById('momentDescInputArea').style.display = 'none';
    } else {
        alert('请输入描述内容！');
    }
}

function renderTempMomentImages() {
    const area = document.getElementById('momentPostImagesArea');
    const addBtnHtml = `
        <div onclick="openMomentTypeModal()" style="width: 100px; height: 100px; background: #f4f4f4; border-radius: 8px; display: flex; justify-content: center; align-items: center; cursor: pointer; border: 1px dashed #ccc;">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#aaa" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
    `;
    
    let imgsHtml = '';
    tempMomentImages.forEach((img, index) => {
        if (img.type === 'real') {
            imgsHtml += `
                <div style="position: relative; width: 100px; height: 100px;">
                    <img src="${img.url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                    <div onclick="removeTempMomentImage(${index})" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #ff3b30; color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 14px; font-weight: bold; cursor: pointer;">×</div>
                </div>
            `;
        } else {
            imgsHtml += `
                <div style="position: relative; width: 100px; height: 100px;">
                    <div class="chat-desc-img-120" style="width: 100% !important; height: 100% !important;"><div class="img-text">${img.text}</div></div>
                    <div onclick="removeTempMomentImage(${index})" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #ff3b30; color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 14px; font-weight: bold; cursor: pointer; z-index: 10;">×</div>
                </div>
            `;
        }
    });
    area.innerHTML = imgsHtml + addBtnHtml;
}

function removeTempMomentImage(index) {
    tempMomentImages.splice(index, 1);
    renderTempMomentImages();
}

function publishMoment() {
    const text = document.getElementById('momentPostText').value.trim();
    if (!text && tempMomentImages.length === 0) {
        return alert('说点什么或者发张图片吧！');
    }

    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    const visibility = document.getElementById('momentVisibilitySelect').value;

    const newMoment = {
        id: Date.now().toString(),
        authorId: currentLoginId,
        content: text,
        images: tempMomentImages,
        visibility: visibility, // 记录可见性分组
        timestamp: Date.now(),
        likes: [],
        comments: []
    };

    let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
    moments.push(newMoment);
    ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(moments));

    // --- 新增：触发 Char 感知系统 ---
    injectCharPerception('post_moment', text || '图片');
    // -------------------------------

    closeMomentPostPanel();
    renderMoments();
}

// 6. 角色 (Char) 通过 API 发朋友圈 (结合人设、面具、世界书、聊天记录)
async function generateCharMoment() {
    if (!currentProfileCharId) return;
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) {
        return alert('请先在设置中配置 API 信息！');
    }

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentProfileCharId);
    if (!char) return;

    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));

    // 获取最近聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentProfileCharId}`) || '[]');
    let recentHistory = history.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`).join('\n');

    // 获取世界书
    let activeWbs = [];
    if (char.wbEntries && char.wbEntries.length > 0) {
        let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
        let entries = wbData.entries.filter(e => char.wbEntries.includes(e.id));
        entries.forEach(entry => {
            if (entry.constant) activeWbs.push(entry.content);
        });
    }

    const prompt = `你现在正在扮演角色：${char.name}。
【你的设定】：${char.description || '无'}
【用户设定】：${persona ? persona.persona : '无'}
【世界书背景】：${activeWbs.join('\n')}
【最近聊天记录】：
${recentHistory || '暂无聊天记录'}

请根据以上所有信息，结合你的人设和最近发生的事情，发布一条“朋友圈动态”。
你可以选择以下三种形式之一：
1. 纯文字：只提供 content。
2. 纯图片：只提供 imageDesc (图片画面的详细文字描述)。
3. 图文结合：同时提供 content 和 imageDesc。

必须且只能返回一个合法的 JSON 对象，格式如下：
{
  "content": "文字内容(不需要则留空)",
  "imageDesc": "图片描述(不需要则留空)"
}
严禁输出任何多余的字符（如 markdown 标记）。`;

    showToast('正在生成朋友圈...', 'loading');

    try {
        const response = await fetch(`${apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8
            })
        });

        if (response.ok) {
            const data = await response.json();
            let replyRaw = data.choices[0].message.content.trim();
            replyRaw = replyRaw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            
            const parsed = JSON.parse(replyRaw);
            
            if (!parsed.content && !parsed.imageDesc) {
                throw new Error("AI 返回内容为空");
            }

            let images = [];
            if (parsed.imageDesc && parsed.imageDesc.trim() !== '') {
                images.push({ type: 'desc', text: parsed.imageDesc.trim() });
            }

            const newMoment = {
                id: Date.now().toString(),
                authorId: currentProfileCharId,
                content: parsed.content || '',
                images: images,
                visibility: 'all', // 角色发的朋友圈默认公开
                timestamp: Date.now(),
                likes: [],
                comments: []
            };

            let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
            moments.push(newMoment);
            ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(moments));

            hideToast();
            alert('角色朋友圈发布成功！');
            
            if (document.getElementById('tab-moment').style.display === 'flex') {
                renderMoments();
            }
        } else {
            const err = await response.json();
            hideToast();
            showApiErrorModal(JSON.stringify(err, null, 2));
        }
    } catch (e) {
        hideToast();
        showApiErrorModal(e.message || '网络请求失败，请检查 API。');
    }
}
// ==========================================
// 音乐邀请详情弹窗逻辑
// ==========================================
function openMusicInviteDetail(index) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId || !currentChatRoomCharId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    const msg = history[index];
    if (!msg || msg.type !== 'music_invite') return;

    // 获取联系人名称
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    const displayName = remarks[currentChatRoomCharId] || (char ? (char.netName || char.name) : '未知');

    // 填充数据
    document.getElementById('midContactName').innerText = displayName;
    
    let statusText = '待回复';
    if (msg.status === 'accepted') statusText = '已同意';
    if (msg.status === 'rejected') statusText = '已拒绝';
    if (msg.status === 'ended') statusText = '已结束';
    document.getElementById('midStatus').innerText = statusText;

    // 兼容旧数据，如果没有 inviteId 则生成一个临时的显示
    const inviteId = msg.inviteId || `invite_${msg.timestamp}_${Math.random().toString(36).substr(2, 6)}`;
    document.getElementById('midInviteId').innerText = inviteId;

    const formatTime = (ts) => {
        if (!ts) return '--';
        const d = new Date(ts);
        return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    };

    document.getElementById('midCreateTime').innerText = formatTime(msg.timestamp);
    document.getElementById('midUpdateTime').innerText = formatTime(msg.updateTime || msg.timestamp);

    // 歌曲信息
    const songInfoEl = document.getElementById('midSongInfo');
    if (msg.songCover && msg.songTitle) {
        songInfoEl.style.display = 'flex';
        document.getElementById('midSongCover').style.backgroundImage = `url('${msg.songCover}')`;
        document.getElementById('midSongTitle').innerText = msg.songTitle;
        document.getElementById('midSongArtist').innerText = msg.songArtist || '未知歌手';
    } else {
        songInfoEl.style.display = 'none';
    }

    document.getElementById('musicInviteDetailOverlay').classList.add('show');
}

function closeMusicInviteDetail() {
    document.getElementById('musicInviteDetailOverlay').classList.remove('show');
}

// ==========================================
// 面具管理全屏面板逻辑
// ==========================================
function openMaskManagerPanel() {
    document.getElementById('maskManagerPanel').style.display = 'flex';
    renderMaskManagerList();
}

function closeMaskManagerPanel() {
    document.getElementById('maskManagerPanel').style.display = 'none';
}

function renderMaskManagerList() {
    const listEl = document.getElementById('maskManagerList');
    if (!listEl) return;
    listEl.innerHTML = '';

    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');

    if (personas.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 40px;">暂无面具，请点击右上角 Addition 添加</div>';
        return;
    }

    personas.forEach(p => {
        // 找到绑定了该面具的账号
        const boundAccounts = accounts.filter(a => a.personaId === p.id);
        
        // 左右分配账号
        const leftAccounts = [];
        const rightAccounts = [];
        boundAccounts.forEach((acc, index) => {
            if (index % 2 === 0) leftAccounts.push(acc);
            else rightAccounts.push(acc);
        });

        const renderAccountHtml = (acc) => `
            <div class="mask-capsule-item">
                <div class="mask-capsule-img" style="background-image: url('${acc.avatarUrl || ''}');"></div>
                <div class="mask-capsule-name">${acc.netName || '未命名'}</div>
            </div>
        `;

        const item = document.createElement('div');
        item.className = 'mask-topology-card';
        
        item.innerHTML = `
            <div class="mask-delete-btn" onclick="deletePersonaFromManager('${p.id}')">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="#ff3b30" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
            
            <div class="mask-topo-layout">
                <div class="mask-topo-side">
                    ${leftAccounts.map(renderAccountHtml).join('')}
                </div>
                
                <div class="mask-topo-center">
                    <div class="mask-center-avatar-wrap" onclick="editPersonaById('${p.id}')" style="cursor: pointer;" title="点击编辑面具">
                        <div class="mask-center-avatar" style="background-image: url('${p.avatarUrl || ''}');"></div>
                    </div>
                    <div class="mask-center-name">“${p.realName || '未命名'}”</div>
                    
                    <!-- 底部标签 -->
                    <div class="mask-topo-tags">
                    </div>
                </div>
                
                <div class="mask-topo-side">
                    ${rightAccounts.map(renderAccountHtml).join('')}
                </div>
            </div>
           
        `;
        listEl.appendChild(item);
    });
}


function deletePersonaFromManager(id) {
    if (confirm('确定要删除这个面具吗？')) {
        let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
        personas = personas.filter(p => p.id !== id);
        ChatDB.setItem('chat_personas', JSON.stringify(personas));
        renderMaskManagerList();
        if (typeof renderChatPersonas === 'function') renderChatPersonas(); // 同步刷新注册弹窗里的列表
    }
}
// ==========================================
// 全局通用输入弹窗逻辑 (复刻主题APP预设弹窗)
// ==========================================
let globalPromptCallback = null;

function openGlobalPrompt(title, desc, placeholder, callback, defaultValue = '') {
    document.getElementById('globalPromptTitle').innerText = title;
    document.getElementById('globalPromptDesc').innerText = desc;
    const inputEl = document.getElementById('globalPromptInput');
    inputEl.placeholder = placeholder || '⸝⸝⸝ ╸▵╺⸝⸝⸝';
    inputEl.value = defaultValue;
    globalPromptCallback = callback;
    
    document.getElementById('globalPromptConfirmBtn').onclick = () => {
        const val = inputEl.value;
        const cb = globalPromptCallback; // 核心修复：先将回调函数保存下来
        closeGlobalPrompt();             // 关闭弹窗（这步会清空 globalPromptCallback）
        if (cb) cb(val);                 // 执行刚刚保存的回调函数，完成数据储存
    };
    
    document.getElementById('globalPromptModalOverlay').classList.add('show');
    setTimeout(() => inputEl.focus(), 100);
}

function closeGlobalPrompt() {
    document.getElementById('globalPromptModalOverlay').classList.remove('show');
    globalPromptCallback = null;
}
// ==========================================
// 关联账号 (Linked Accounts) 核心逻辑
// ==========================================

function initLinkedAccountToggle() {
    const toggle = document.getElementById('toggleLinkedAccount');
    if (!toggle) return;
    
    toggle.addEventListener('change', (e) => {
        const currentLoginId = ChatDB.getItem('current_login_account');
        if (!currentLoginId) return;
        
        ChatDB.setItem(`linked_account_enabled_${currentLoginId}`, e.target.checked ? 'true' : 'false');
        if (typeof renderChatList === 'function') renderChatList();
    });
}

let isLinkedAccManaging = false;
let currentSelectedLinkedAccId = 'all'; // 新增：记录当前选中的关联账号ID

function toggleLinkedAccManageMode() {
    isLinkedAccManaging = !isLinkedAccManaging;
    const btn = document.getElementById('linkedAccManageBtn');
    if (isLinkedAccManaging) {
        btn.innerText = '完成';
    } else {
        btn.innerText = '管理';
    }
    renderLinkedAccounts();
}

function openLinkedAccountManager() {
    isLinkedAccManaging = false;
    currentSelectedLinkedAccId = 'all'; // 每次打开重置为显示全部
    document.getElementById('linkedAccManageBtn').innerText = '管理';
    document.getElementById('linkedAccountManagerPanel').style.display = 'flex';
    
    // 同步开关状态
    const currentLoginId = ChatDB.getItem('current_login_account');
    const isEnabled = ChatDB.getItem(`linked_account_enabled_${currentLoginId}`) !== 'false'; // 默认开启
    document.getElementById('linkedAccMsgToggle').checked = isEnabled;
    
    document.getElementById('linkedAccMsgToggle').onchange = (e) => {
        ChatDB.setItem(`linked_account_enabled_${currentLoginId}`, e.target.checked ? 'true' : 'false');
        if (typeof renderChatList === 'function') renderChatList();
    };

    renderLinkedAccounts();
}

function closeLinkedAccountManager() {
    document.getElementById('linkedAccountManagerPanel').style.display = 'none';
}

function addLinkedAccount(id) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    
    let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
    let targetLinkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${id}`) || '[]');

    // 核心修改：限制最多只能关联 3 个账号
    if (!linkedAccounts.includes(id) && linkedAccounts.length >= 3) {
        return alert('您最多只能关联 3 个账号！');
    }
    if (!targetLinkedAccounts.includes(currentLoginId) && targetLinkedAccounts.length >= 3) {
        return alert('对方关联的账号数量已达上限（3个），无法关联！');
    }

    if (!linkedAccounts.includes(id)) {
        linkedAccounts.push(id);
        ChatDB.setItem(`linked_accounts_${currentLoginId}`, JSON.stringify(linkedAccounts));
    }
    
    // 核心修改：双向关联，把当前账号也加到目标账号的关联列表里
    if (!targetLinkedAccounts.includes(currentLoginId)) {
        targetLinkedAccounts.push(currentLoginId);
        ChatDB.setItem(`linked_accounts_${id}`, JSON.stringify(targetLinkedAccounts));
    }

    renderLinkedAccounts();
    if (typeof renderChatList === 'function') renderChatList();
}

function removeLinkedAccount(id) {
    if (confirm('确定要解除关联该账号吗？')) {
        const currentLoginId = ChatDB.getItem('current_login_account');
        let linkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${currentLoginId}`) || '[]');
        linkedAccounts = linkedAccounts.filter(accId => accId !== id);
        ChatDB.setItem(`linked_accounts_${currentLoginId}`, JSON.stringify(linkedAccounts));
        
        // 核心修改：双向解除关联，把当前账号从目标账号的关联列表中移除
        let targetLinkedAccounts = JSON.parse(ChatDB.getItem(`linked_accounts_${id}`) || '[]');
        targetLinkedAccounts = targetLinkedAccounts.filter(accId => accId !== currentLoginId);
        ChatDB.setItem(`linked_accounts_${id}`, JSON.stringify(targetLinkedAccounts));

        renderLinkedAccounts();
        if (typeof renderChatList === 'function') renderChatList();
    }
}

function switchToLinkedAccount(id) {
    const allEntities = getAllEntities();
    const targetEntity = allEntities.find(e => e.id === id);
    
    if (!targetEntity) return alert('目标账号不存在！');

    // 核心修改：直接允许 Char 登录，不再创建冗余的虚拟账号
    ChatDB.setItem('current_login_account', id);
    closeLinkedAccountManager();
    
    // 刷新整个微信界面
    renderMePage();
    if (typeof renderChatList === 'function') renderChatList();
    if (typeof renderContactList === 'function') renderContactList();
    if (typeof renderMoments === 'function') renderMoments();
    
    alert(`已切换至账号: ${targetEntity.netName || targetEntity.name}`);
}

// 初始化开关事件
window.addEventListener('ChatDBReady', () => {
    initLinkedAccountToggle();
});

// ==========================================
// Char 账号专属：生成真实社交聊天记录
// ==========================================
async function generateCharSocialChatAPI() {
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return;

    let allEntities = getAllEntities();
    const char = allEntities.find(c => c.id === currentLoginId);
    if (!char || char.isAccount) return;

    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    // 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 获取当前 Char 的通讯录好友 (排除真实 User 账号)
    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    let existingFriends = contacts.map(id => allEntities.find(e => e.id === id))
                                  .filter(e => e && !e.isAccount)
                                  .map(e => e.netName || e.name);
    let friendsContext = existingFriends.length > 0 
        ? `你当前的通讯录里有这些好友：${existingFriends.join(', ')}。你可以优先选择和他们聊天。` 
        : `你当前通讯录为空，请自由生成新的好友或群聊。`;

    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    prompt += `【通讯录情报】：${friendsContext}\n`;

    prompt += `\n请基于你的人设和当前生活状态，生成你的微信聊天列表和聊天记录（包含 3-5 个会话）。\n`;
    prompt += `⚠️【极其重要的要求】：\n`;
    prompt += `1. 【绝对禁止】：绝对不要生成与玩家/用户(User)的聊天记录！只生成你和你的亲戚、朋友、同事、同学等 NPC 的日常社交！\n`;
    prompt += `2. 聊天内容必须是真实的社交日常！例如：吐槽奇葩老板、聊游戏开黑、拼单点外卖、借钱、分享搞笑视频等。\n`;
    prompt += `3. 每个会话的聊天记录必须不少于 10 条消息！请充分展开对话细节，展现人物性格和关系。\n`;
    prompt += `4. 聊天记录 history 中的 role 字段，只能是 "me"（代表你发出的消息）或 "other"（代表对方发出的消息）。\n`;
    prompt += `5. 你可以生成单人聊天，也可以生成【群聊】。如果是群聊，请将 isGroup 设为 true，并且在 other 发送的消息中带上名字前缀（如 "张三: 吃饭没"）。\n`;
    
    prompt += `\n必须返回合法的 JSON 格式，结构如下：\n`;
    prompt += `[\n`;
    prompt += `  {\n`;
    prompt += `    "name": "NPC名字(如: 老妈, 张三)", "isGroup": false, "signature": "NPC的个性签名",\n`;
    prompt += `    "history": [\n`;
    prompt += `      {"role": "other", "content": "在干嘛？"},\n`;
    prompt += `      {"role": "me", "content": "刚吃完饭"}\n`;
    prompt += `    ]\n`;
    prompt += `  },\n`;
    prompt += `  {\n`;
    prompt += `    "name": "工作群/家族群", "isGroup": true, "signature": "群聊简介",\n`;
    prompt += `    "history": [\n`;
    prompt += `      {"role": "other", "content": "老板: 收到请回复"},\n`;
    prompt += `      {"role": "me", "content": "收到"}\n`;
    prompt += `    ]\n`;
    prompt += `  }\n`;
    prompt += `]`;

    showToast('正在生成社交聊天记录...', 'loading');

    try {
        const response = await fetch(`${apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
            body: JSON.stringify({ model: apiConfig.model, messages: [{ role: 'user', content: prompt }], temperature: 0.8 })
        });

        if (response.ok) {
            const data = await response.json();
            let replyRaw = data.choices[0].message.content.trim();
            replyRaw = replyRaw.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            
            const parsed = JSON.parse(replyRaw);
            
            let npcs = JSON.parse(ChatDB.getItem('chat_npcs') || '[]');
            let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
            let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');

            parsed.forEach(session => {
                // 查找或创建 NPC/群聊
                let npc = npcs.find(n => n.name === session.name);
                let npcId;
                if (npc) {
                    npcId = npc.id;
                    // 如果大模型把它当成了群聊，更新一下属性
                    if (session.isGroup) npc.isGroup = true;
                } else {
                    npcId = 'npc_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    npcs.push({
                        id: npcId,
                        name: session.name,
                        netName: session.name,
                        signature: session.signature || (session.isGroup ? '群聊' : '这个人很懒，什么都没写~'),
                        description: session.isGroup ? `这是 ${char.name} 的一个群聊。` : `这是 ${char.name} 的通讯录好友。`,
                        group: session.isGroup ? '群聊' : 'NPC',
                        isNPC: true,
                        isGroup: session.isGroup || false,
                        avatarUrl: ''
                    });
                }

                // 加入通讯录和会话列表
                if (!contacts.includes(npcId)) contacts.push(npcId);
                if (!sessions.includes(npcId)) sessions.unshift(npcId);

                // 转换并保存真实的聊天记录
                let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${npcId}`) || '[]');
                let baseTime = Date.now() - session.history.length * 60000; // 模拟过去的时间
                
                session.history.forEach((msg, idx) => {
                    history.push({
                        role: msg.role === 'me' ? 'user' : 'char', // 在当前账号视角，me就是user(自己)，other就是char(对方)
                        content: msg.content,
                        timestamp: baseTime + idx * 60000
                    });
                });
                ChatDB.setItem(`chat_history_${currentLoginId}_${npcId}`, JSON.stringify(history));
            });

            ChatDB.setItem('chat_npcs', JSON.stringify(npcs));
            ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));
            ChatDB.setItem(`contacts_${currentLoginId}`, JSON.stringify(contacts));

            renderChatList();
            hideToast();
            alert('社交聊天记录生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}
