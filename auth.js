// ==========================================
// 身份验证与防二传核心逻辑 (auth.js)
// ==========================================
const SUPABASE_URL = 'https://ofsvczapcsudymnijjrq.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_IbfurTy7b2S3SnmnhDqL7Q_vFfQi9PA';

// 初始化 Supabase
let supabaseClient = null;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 1. 页面加载时立刻检查是否已登录
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    const overlay = document.getElementById('auth-overlay');
    const mainApp = document.getElementById('iphone-container');

    if (token) {
        overlay.style.display = 'none';
        mainApp.style.display = 'flex';
    } else {
        overlay.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

// 2. 核心算法：生成激活码
function generateCodeForQQ(qq) {
    const salt = "HONEY-STUDIO-V2-SECRET-20260309";
    const baseString = `${qq}#${salt}`;
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        const char = baseString.charCodeAt(i);
        hash = ((hash << 7) - hash) + char;
        hash |= 0; 
    }
    hash = Math.abs(hash);
    const hexHash = hash.toString(16).toUpperCase();
    const qqInfo = `${qq.length}${qq.slice(-2)}`;
    return `V2-${qqInfo}-${hexHash}`.substring(0, 16);
}

// 3. 切换面板逻辑
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-section').forEach(section => section.classList.remove('active'));
    if(tab === 'login') {
        document.getElementById('auth-section-login').classList.add('active');
    } else if(tab === 'register') {
        document.getElementById('auth-section-register').classList.add('active');
    } else if(tab === 'reset') {
        document.getElementById('auth-section-reset').classList.add('active');
    }
}

// 4. 密码小眼睛切换逻辑
function toggleAuthPassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    } else {
        input.type = 'password';
        iconEl.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    }
}

// 5. 激活码注册逻辑
async function handleAppBind() {
    const qq = document.getElementById('auth-bind-qq').value.trim();
    const code = document.getElementById('auth-bind-code').value.trim();
    const pwd = document.getElementById('auth-bind-pwd').value.trim();
    const pwdConfirm = document.getElementById('auth-bind-pwd-confirm').value.trim();
    const btn = document.getElementById('auth-btn-bind');

    if (!qq || !code || !pwd || !pwdConfirm) return alert('请填写完整信息！');
    if (pwd !== pwdConfirm) return alert('两次输入的密码不一致，请重新输入！');

    btn.disabled = true; btn.innerText = '验证中...';

    try {
        if (!supabaseClient) throw new Error('网络连接失败，无法连接到验证服务器！\n请检查网络或尝试开启/关闭加速器后刷新页面。');

        const expectedCode = generateCodeForQQ(qq);
        if (code !== expectedCode) throw new Error('激活码与QQ号不匹配，或激活码无效！');

        const { error } = await supabaseClient.from('vip_keys').insert([{ code: code, qq: qq, password: pwd, is_used: true }]);
        if (error) {
            if (error.code === '23505') throw new Error('该 QQ 号已注册，或该激活码已被使用！');
            throw error;
        }

        alert('注册成功！请登录。');
        switchAuthTab('login');
        document.getElementById('auth-login-qq').value = qq;
        document.getElementById('auth-login-pwd').value = ''; 
        document.getElementById('auth-bind-pwd').value = ''; 
        document.getElementById('auth-bind-pwd-confirm').value = ''; 
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false; btn.innerText = '注 册';
    }
}

// 6. QQ 登录逻辑 (包含无敌管理员后门)
async function handleAppLogin() {
    const qq = document.getElementById('auth-login-qq').value.trim();
    const pwd = document.getElementById('auth-login-pwd').value.trim();
    const btn = document.getElementById('auth-btn-login');

    if (!qq || !pwd) return alert('请输入 QQ 号和密码！');

    // 【终极特权】：放在最前面！无视网络、无视数据库，直接秒进！
    if (qq === '746406001' && pwd === '14831a03') {
        localStorage.setItem('auth_token', 'valid_user_' + qq);
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('iphone-container').style.display = 'flex';
        return; 
    }

    btn.disabled = true; btn.innerText = '登录中...';

    try {
        if (!supabaseClient) throw new Error('网络连接失败，无法连接到验证服务器！\n请检查网络或尝试开启/关闭加速器后刷新页面。');

        const { data, error } = await supabaseClient.from('vip_keys').select('*').eq('qq', qq).eq('password', pwd).single();
        if (error || !data) throw new Error('QQ号或密码错误！');

        localStorage.setItem('auth_token', 'valid_user_' + qq);
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('iphone-container').style.display = 'flex';
        
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false; btn.innerText = '登 录';
    }
}

// 7. 忘记密码重置逻辑
async function handleAppResetPwd() {
    const qq = document.getElementById('auth-reset-qq').value.trim();
    const code = document.getElementById('auth-reset-code').value.trim();
    const pwd = document.getElementById('auth-reset-pwd').value.trim();
    const pwdConfirm = document.getElementById('auth-reset-pwd-confirm').value.trim();
    const btn = document.getElementById('auth-btn-reset');

    if (!qq || !code || !pwd || !pwdConfirm) return alert('请填写完整信息！');
    if (pwd !== pwdConfirm) return alert('两次输入的密码不一致，请重新输入！');

    btn.disabled = true; btn.innerText = '验证中...';

    try {
        if (!supabaseClient) throw new Error('网络连接失败，无法连接到验证服务器！\n请检查网络或尝试开启/关闭加速器后刷新页面。');

        const expectedCode = generateCodeForQQ(qq);
        if (code !== expectedCode) throw new Error('激活码与QQ号不匹配，验证失败！');

        const { error } = await supabaseClient.from('vip_keys').update({ password: pwd }).eq('qq', qq);
        if (error) throw new Error('重置密码失败，请确认该账号是否已注册！');

        alert('密码重置成功！请使用新密码登录。');
        switchAuthTab('login');
        document.getElementById('auth-login-qq').value = qq;
        document.getElementById('auth-login-pwd').value = ''; 
        document.getElementById('auth-reset-pwd').value = ''; 
        document.getElementById('auth-reset-pwd-confirm').value = ''; 
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false; btn.innerText = '重置密码';
    }
}

// 8. Discord 登录逻辑
async function handleAppDiscordLogin() {
    try {
        if (!supabaseClient) throw new Error('网络连接失败，无法连接到验证服务器！\n请检查网络或尝试开启/关闭加速器后刷新页面。');
        
        const exactRedirectUrl = 'https://yuan007-ovo.github.io/xiyuyu/index.html';
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({ 
            provider: 'discord',
            options: { 
                scopes: 'identify email guilds',
                redirectTo: exactRedirectUrl
            }
        });
        if (error) throw new Error(error.message);
    } catch (err) {
        alert('Discord 登录失败: ' + err.message);
    }
}

// 9. 页面加载时检查 Discord Session
document.addEventListener('DOMContentLoaded', () => {
    if (supabaseClient) {
        supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
            if (session && session.provider_token) {
                const TARGET_GUILD_ID = '1434236443818983580'; 
                try {
                    const res = await fetch('https://discord.com/api/users/@me/guilds', {
                        headers: { Authorization: `Bearer ${session.provider_token}` }
                    });
                    if (!res.ok) throw new Error('无法获取服务器列表');
                    
                    const guilds = await res.json();
                    const isInGuild = guilds.some(guild => guild.id === TARGET_GUILD_ID);

                    if (isInGuild) {
                        localStorage.setItem('auth_token', 'discord_' + session.user.id);
                        document.getElementById('auth-overlay').style.display = 'none';
                        document.getElementById('iphone-container').style.display = 'flex';
                    } else {
                        alert('抱歉，您必须加入指定的 Discord 社区服务器才能使用本程序！');
                        await supabaseClient.auth.signOut();
                        localStorage.removeItem('auth_token');
                    }
                } catch (err) {
                    console.error('验证 DC 服务器失败', err);
                    alert('验证 Discord 身份状态失败，请重新点击授权登录！');
                    await supabaseClient.auth.signOut();
                    localStorage.removeItem('auth_token');
                }
            }
        });
    }
});

// 10. 账号管理与退出登录逻辑
function openAccountManagePanel() {
    const token = localStorage.getItem('auth_token');
    let displayQQ = '未登录';
    if (token && token.startsWith('valid_user_')) {
        displayQQ = token.replace('valid_user_', '');
    } else if (token && token.startsWith('discord_')) {
        displayQQ = 'Discord 用户';
    }
    document.getElementById('current-logged-in-qq').innerText = displayQQ;
    document.getElementById('accountManagePanel').style.display = 'flex';
}

function closeAccountManagePanel() {
    document.getElementById('accountManagePanel').style.display = 'none';
}

function logoutApp() {
    if(confirm('确定要退出当前账号吗？')) {
        localStorage.removeItem('auth_token');
        if (supabaseClient) supabaseClient.auth.signOut(); 
        document.getElementById('accountManagePanel').style.display = 'none';
        document.getElementById('settingsFullScreenPanel').style.display = 'none';
        document.getElementById('iphone-container').style.display = 'none';
        document.getElementById('auth-overlay').style.display = 'flex';
        switchAuthTab('login');
    }
}

// 11. 系统密码面板开关与修改逻辑
function openAuthModifyPasswordPanel() {
    document.getElementById('authOldPassInput').value = '';
    document.getElementById('authNewPassInput1').value = '';
    document.getElementById('authNewPassInput2').value = '';
    document.getElementById('authModifyPasswordPanel').style.display = 'flex';
}

function closeAuthModifyPasswordPanel() {
    document.getElementById('authModifyPasswordPanel').style.display = 'none';
}

async function showAuthOldPasswordHint() {
    const token = localStorage.getItem('auth_token');
    if (!token || !token.startsWith('valid_user_')) return alert('当前未绑定QQ账号，无法找回密码！');
    
    const qq = token.replace('valid_user_', '');
    try {
        if (!supabaseClient) throw new Error('网络连接失败');
        const { data, error } = await supabaseClient.from('vip_keys').select('password').eq('qq', qq).single();
        if (error || !data) throw new Error('查询失败');
        alert('您的系统旧密码是：' + data.password);
    } catch (err) {
        alert('获取旧密码失败！请检查网络。');
    }
}

async function executeAuthModifyPassword() {
    const oldPwd = document.getElementById('authOldPassInput').value.trim();
    const newPwd1 = document.getElementById('authNewPassInput1').value.trim();
    const newPwd2 = document.getElementById('authNewPassInput2').value.trim();

    if (!oldPwd || !newPwd1 || !newPwd2) return alert('请填写完整信息！');
    if (newPwd1 !== newPwd2) return alert('两次输入的新密码不一致！');

    const token = localStorage.getItem('auth_token');
    if (!token || !token.startsWith('valid_user_')) return alert('当前账号状态异常，无法修改密码！');
    const qq = token.replace('valid_user_', '');

    try {
        if (!supabaseClient) throw new Error('网络连接失败，无法连接到验证服务器！');

        const { data, error } = await supabaseClient.from('vip_keys').select('*').eq('qq', qq).eq('password', oldPwd).single();
        if (error || !data) throw new Error('旧密码错误！');

        const { error: updateError } = await supabaseClient.from('vip_keys').update({ password: newPwd1 }).eq('qq', qq);
        if (updateError) throw new Error('密码修改失败！');

        alert('系统密码修改成功！请重新登录。');
        document.getElementById('authOldPassInput').value = '';
        document.getElementById('authNewPassInput1').value = '';
        document.getElementById('authNewPassInput2').value = '';
        closeAuthModifyPasswordPanel();
        logoutApp(); 
    } catch (err) {
        alert(err.message);
    }
}
