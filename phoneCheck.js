// ==========================================
// 查手机功能专属逻辑 (phoneCheck.js)
// ==========================================

// 初始化：保存默认的 SVG 图标，方便后续恢复
document.addEventListener('DOMContentLoaded', () => {
    const apps = document.querySelectorAll('.desktop-app .app-icon, .phone-dock .app-icon');
    apps.forEach(iconEl => {
        iconEl.setAttribute('data-default-svg', iconEl.innerHTML);
    });
});

// 打开查手机全屏遮罩
function openPhoneCheck() {
    // 核心修改：拦截 Char 账号使用查手机功能
    const currentLoginId = ChatDB.getItem('current_login_account');
    let allEntities = typeof getAllEntities === 'function' ? getAllEntities() : [];
    const me = allEntities.find(a => a.id === currentLoginId);
    if (me && !me.isAccount) {
        alert('角色账号无法使用查手机功能！');
        return;
    }

    // 新增：拦截查看其他真实用户账号的手机
    if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId) {
        const target = allEntities.find(a => a.id === currentChatRoomCharId);
        if (target && target.isAccount) {
            alert('无法查看其他真实用户的手机！');
            return;
        }
    }

    // 关闭可能存在的更多面板
    const morePanel = document.getElementById('crMorePanel');
    if (morePanel) morePanel.classList.remove('show');
    
    // 恢复全屏状态
    const isFull = ChatDB.getItem('phone_check_fullscreen') === 'true';
    if (isFull) {
        document.getElementById('phoneCheckOverlay').classList.add('is-fullscreen');
    } else {
        document.getElementById('phoneCheckOverlay').classList.remove('is-fullscreen');
    }
    
    // 动态加载当前聊天室 Char 的头像、名字以及保存的自定义装扮
    if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId) {
        let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        const char = chars.find(c => c.id === currentChatRoomCharId);
        
        if (char) {
            const avatarUrl = char.avatarUrl || '';
            const charName = char.netName || char.name || '未知角色';
            
            // 1. 恢复头像和名字
            const stampInner = document.querySelector('.char-stamp-inner');
            if (stampInner) stampInner.style.backgroundImage = `url('${avatarUrl}')`;
            
            const profileAvatar = document.querySelector('.profile-avatar');
            if (profileAvatar) profileAvatar.style.backgroundImage = `url('${avatarUrl}')`;
            
            const sidebarAvatar = document.querySelector('.sidebar-avatar');
            if (sidebarAvatar) sidebarAvatar.style.backgroundImage = `url('${avatarUrl}')`;
            
            const profileName = document.querySelector('.profile-name');
            if (profileName) profileName.innerText = charName;
        }

        // 2. 恢复壁纸
        const savedWallpaper = ChatDB.getItem(`phone_check_wallpaper_${currentChatRoomCharId}`);
        const wallpaperEl = document.getElementById('phoneWallpaper');
        if (wallpaperEl) {
            if (savedWallpaper) {
                wallpaperEl.style.backgroundImage = `url(${savedWallpaper})`;
            } else {
                wallpaperEl.style.backgroundImage = ''; // 恢复默认浅灰
            }
        }

        // 3. 恢复小组件背景
        const savedWidgetBg = ChatDB.getItem(`phone_check_widget_bg_${currentChatRoomCharId}`);
        const widgetBgEl = document.getElementById('widgetBg');
        if (widgetBgEl) {
            if (savedWidgetBg) {
                widgetBgEl.style.backgroundImage = `url(${savedWidgetBg})`;
            } else {
                widgetBgEl.style.backgroundImage = ''; // 恢复默认白色
            }
        }

        // 4. 恢复自定义图标
        const savedIcons = JSON.parse(ChatDB.getItem(`phone_check_icons_${currentChatRoomCharId}`) || '{}');
        const apps = document.querySelectorAll('.desktop-app .app-icon, .phone-dock .app-icon');
        apps.forEach(iconEl => {
            const appId = iconEl.id;
            if (savedIcons[appId]) {
                iconEl.innerHTML = '';
                iconEl.style.backgroundImage = `url(${savedIcons[appId]})`;
                iconEl.style.backgroundSize = 'cover';
                iconEl.style.backgroundPosition = 'center';
            } else {
                // 如果没有自定义图标，恢复默认 SVG
                iconEl.style.backgroundImage = '';
                if (iconEl.hasAttribute('data-default-svg')) {
                    iconEl.innerHTML = iconEl.getAttribute('data-default-svg');
                }
            }
        });
    }

    document.getElementById('phoneCheckOverlay').classList.add('show');
}

// 关闭查手机全屏遮罩
function closePhoneCheck() {
    document.getElementById('phoneCheckOverlay').classList.remove('show');
    document.getElementById('charSidebar').classList.remove('open');
}

// 切换侧边栏
function toggleSidebar() {
    document.getElementById('charSidebar').classList.toggle('open');
}

// 切换全屏模式 (带持久化)
function togglePhoneFullscreen() {
    const overlay = document.getElementById('phoneCheckOverlay');
    overlay.classList.toggle('is-fullscreen');
    const isFull = overlay.classList.contains('is-fullscreen');
    ChatDB.setItem('phone_check_fullscreen', isFull ? 'true' : 'false');
    toggleSidebar(); // 切换后收起侧边栏
}

// ==========================================
// 壁纸与背景上传逻辑 (带持久化)
// ==========================================
function triggerWallpaperUpload() {
    document.getElementById('wallpaperUploadInput').click();
}

function handleWallpaperUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const result = e.target.result;
            document.getElementById('phoneWallpaper').style.backgroundImage = `url(${result})`;
            
            // 保存到数据库
            if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId) {
                ChatDB.setItem(`phone_check_wallpaper_${currentChatRoomCharId}`, result);
            }
        }
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function triggerWidgetBgUpload() {
    document.getElementById('widgetBgUploadInput').click();
}

function handleWidgetBgUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const result = e.target.result;
            document.getElementById('widgetBg').style.backgroundImage = `url(${result})`;
            
            // 保存到数据库
            if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId) {
                ChatDB.setItem(`phone_check_widget_bg_${currentChatRoomCharId}`, result);
            }
        }
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

// ==========================================
// 图标更换逻辑 (带持久化与保存确认)
// ==========================================
let currentEditingIconId = null;
let tempIconData = null; // 暂存上传的图标数据

function openIconModal() {
    const grid = document.getElementById('iconModalGrid');
    grid.innerHTML = '';
    tempIconData = null; // 打开时清空暂存
    
    // 获取桌面和Dock的图标
    const apps = document.querySelectorAll('.desktop-app .app-icon, .phone-dock .app-icon');
    
    apps.forEach((iconEl, index) => {
        const parentApp = iconEl.closest('.desktop-app');
        const nameEl = parentApp ? parentApp.querySelector('.app-name') : null;
        const name = nameEl ? nameEl.innerText : `Dock App ${index - 3}`;
        const appId = iconEl.id;

        const item = document.createElement('div');
        item.className = 'icon-modal-item';
        item.dataset.appId = appId; // 记录 ID 方便后续查找
        item.innerHTML = `
            <div class="icon-modal-preview">${iconEl.innerHTML}</div>
            <div class="icon-modal-name">${name}</div>
        `;
        
        // 复制背景图
        if (iconEl.style.backgroundImage) {
            item.querySelector('.icon-modal-preview').style.backgroundImage = iconEl.style.backgroundImage;
            item.querySelector('.icon-modal-preview').innerHTML = '';
        }

        item.onclick = () => {
            currentEditingIconId = appId;
            document.getElementById('iconUploadInput').click();
        };
        grid.appendChild(item);
    });

    // 新增：恢复默认图标按键
    const resetItem = document.createElement('div');
    resetItem.className = 'icon-modal-item';
    resetItem.innerHTML = `
        <div class="icon-modal-preview" style="background: #ffffff; border: none;">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
        </div>
        <div class="icon-modal-name" style="color: #000000; font-weight: bold;">恢复默认</div>
    `;
    resetItem.onclick = () => {
        if(confirm('确定要恢复所有图标为默认样式吗？')) {
            resetDefaultIcons();
        }
    };
    grid.appendChild(resetItem);

    document.getElementById('iconModalOverlay').classList.add('show');
    document.getElementById('charSidebar').classList.remove('open'); // 收起侧边栏
}

// 新增：恢复默认图标逻辑
function resetDefaultIcons() {
    if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId) {
        // 清除数据库中的自定义图标记录
        ChatDB.removeItem(`phone_check_icons_${currentChatRoomCharId}`);
        
        // 恢复桌面和 Dock 上的图标
        const apps = document.querySelectorAll('.desktop-app .app-icon, .phone-dock .app-icon');
        apps.forEach(iconEl => {
            iconEl.style.backgroundImage = '';
            if (iconEl.hasAttribute('data-default-svg')) {
                iconEl.innerHTML = iconEl.getAttribute('data-default-svg');
            }
        });
    }
    closeIconModal();
}

function closeIconModal() {
    tempIconData = null;
    currentEditingIconId = null;
    document.getElementById('iconModalOverlay').classList.remove('show');
}

function handleIconUpload(event) {
    const file = event.target.files[0];
    if (file && currentEditingIconId) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempIconData = e.target.result;
            // 仅更新弹窗内的预览图，不直接修改桌面
            const items = document.querySelectorAll('.icon-modal-item');
            items.forEach(item => {
                if (item.dataset.appId === currentEditingIconId) {
                    const preview = item.querySelector('.icon-modal-preview');
                    preview.innerHTML = '';
                    preview.style.backgroundImage = `url(${tempIconData})`;
                    preview.style.backgroundSize = 'cover';
                    preview.style.backgroundPosition = 'center';
                }
            });
        }
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function saveIconChanges() {
    if (currentEditingIconId && tempIconData) {
        const targetIcon = document.getElementById(currentEditingIconId);
        if (targetIcon) {
            targetIcon.innerHTML = ''; // 清空 SVG
            targetIcon.style.backgroundImage = `url(${tempIconData})`;
            targetIcon.style.backgroundSize = 'cover';
            targetIcon.style.backgroundPosition = 'center';
            
            // 保存到数据库
            if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId) {
                let savedIcons = JSON.parse(ChatDB.getItem(`phone_check_icons_${currentChatRoomCharId}`) || '{}');
                savedIcons[currentEditingIconId] = tempIconData;
                ChatDB.setItem(`phone_check_icons_${currentChatRoomCharId}`, JSON.stringify(savedIcons));
            }
        }
    }
    closeIconModal();
}
// ==========================================
// 查手机 - TikTok 交互逻辑
// ==========================================

function openPhoneTiktok() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');
    
    // 动态加载当前角色的头像和名字到 TikTok 个人主页
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (char) {
        const avatarUrl = char.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop';
        const charName = char.netName || char.name || 'User';
        
        // 替换头像 (仅限个人主页，不影响推荐流的路人)
        document.querySelectorAll('.tk-profile-avatar-large').forEach(el => {
            el.style.backgroundImage = `url('${avatarUrl}')`;
        });
        
        // 替换名字 (仅限个人主页)
        document.querySelectorAll('.tk-profile-title, .tk-profile-handle').forEach(el => {
            if (el.classList.contains('tk-profile-handle')) {
                el.innerText = '@' + charName;
            } else {
                el.innerText = charName;
            }
        });
    }

    document.getElementById('phoneTiktokApp').classList.add('show');
    switchTiktokTab('home'); // 默认打开首页
    
    // 尝试渲染已有数据
    renderTkHomeFeed();
    renderTkSearch();
    renderTkProfileFeed();
    renderTkInbox();
    renderTkDrafts();
}

function closePhoneTiktok() {
    document.getElementById('phoneTiktokApp').classList.remove('show');
}

function switchTiktokTab(tabId) {
    // 隐藏所有页面
    document.querySelectorAll('.tk-page').forEach(p => p.classList.remove('active'));
    // 取消所有底部导航高亮
    document.querySelectorAll('.tk-nav-item').forEach(n => n.classList.remove('active'));
    
    // 显示目标页面
    document.getElementById('tk-page-' + tabId).classList.add('active');
    // 高亮对应导航
    document.getElementById('tk-nav-' + tabId).classList.add('active');
}

// ==========================================
// TikTok API 生成与渲染逻辑
// ==========================================

async function generateTiktokDataAPI() {
    if (!currentChatRoomCharId) return;
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 1. 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 3. 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 4. 构建 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，生成该角色手机里 TikTok (抖音) 的相关数据。
【核心生成要求】：
1. 首页推荐 (foryou)：生成 3-5 个视频。必须是其他NPC/路人发布的视频（绝对不能是你自己）。内容必须和最近聊天的话题相关，或者是你潜意识里关注的事物。必须生成 5 条具体的网友评论。
2. 个人主页 (profile)：生成你自己发布的 4 个视频。这些视频的文案(desc)和画面(videoContent)都必须和 User(${userName}) 有关，表达对 User 的真实情绪，或者是记录 User 相关的事情！必须生成 5 条具体的网友评论。
3. 抖音热搜 (trending)：生成 4-6 个热搜标题。符合当前世界观或你的兴趣。
4. 私信消息 (inbox)：生成 2-4 条私信。【重点】：私信内容必须是路人或熟人对你在个人主页 (profile) 发布的视频的反应或搭讪！

必须返回合法的 JSON，结构如下：
{
  "foryou": [
    {
      "author": "路人作者名",
      "videoContent": "视频画面内容的详细描述",
      "desc": "视频文案",
      "likes": "1.2M",
      "commentsCount": "45K",
      "music": "音乐名",
      "comments": [
        {"user": "网友A", "content": "评论内容"}
      ]
    }
  ],
  "trending": [
    {"title": "热搜标题", "hot": "123W"}
  ],
  "profile": [
    {
      "videoContent": "视频画面内容的详细描述(必须与${userName}有关)",
      "desc": "视频文案(必须与${userName}有关)",
      "likes": "10K",
      "commentsCount": "120",
      "comments": [
        {"user": "网友B", "content": "评论内容"}
      ]
    }
  ],
  "inbox": [
    {
      "name": "发件人(路人/熟人)",
      "lastMsg": "最后一条消息",
      "time": "1h",
      "history": [
        {"role": "other", "content": "针对你发布的某个视频的搭讪或反应"},
        {"role": "me", "content": "你的回复"}
      ]
    }
  ],
  "drafts": [
    {"desc": "草稿描述，例如：尝试了新的猫咪特效，太搞笑了"}
  ]
}`;

    showToast('正在生成 TikTok 数据...', 'loading');

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
            ChatDB.setItem(`tiktok_data_${currentChatRoomCharId}`, JSON.stringify(parsed));
            
            // 渲染所有页面
            renderTkHomeFeed();
            renderTkSearch();
            renderTkProfileFeed();
            renderTkInbox();
            renderTkDrafts();
            
            hideToast();
            alert('TikTok 数据生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}

// 渲染 Search 抖音热搜
function renderTkSearch() {
    const list = document.getElementById('tkSearchList');
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    if (!data.trending || data.trending.length === 0) return;

    list.innerHTML = '';
    data.trending.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'tk-search-item';
        let rankClass = index === 0 ? 'top1' : (index === 1 ? 'top2' : (index === 2 ? 'top3' : ''));
        el.innerHTML = `
            <div class="tk-search-rank ${rankClass}">${index + 1}</div>
            <div class="tk-search-info">
                <div class="tk-search-title">${item.title}</div>
                <div class="tk-search-hot">${item.hot} 热度</div>
            </div>
        `;
        list.appendChild(el);
    });
}

// 渲染 Home 推荐视频流
function renderTkHomeFeed() {
    const container = document.getElementById('tkHomeFeed');
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    if (!data.foryou || data.foryou.length === 0) return;

    container.innerHTML = '';
    data.foryou.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'tk-video-item';
        item.innerHTML = `
            <div class="tk-video-content-display" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; padding: 20px; z-index: 1; pointer-events: none;">
                <div style="width: 250px; text-align: center; color: rgba(255,255,255,0.8); font-size: 16px; word-wrap: break-word; white-space: normal;">
                    [视频画面]<br>${video.videoContent || '无画面描述'}
                </div>
            </div>
            <div class="tk-right-actions" style="z-index: 2;">
                <div class="tk-avatar-wrapper"><div class="tk-avatar-plus">+</div></div>
                <div class="tk-action-item"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span class="tk-action-text">${video.likes}</span></div>
                <div class="tk-action-item" onclick="openTkComments('foryou', ${index})"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/></svg><span class="tk-action-text">${video.commentsCount}</span></div>
                <div class="tk-action-item"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg><span class="tk-action-text">Save</span></div>
                <div class="tk-action-item"><svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11V5z"/></svg><span class="tk-action-text">Share</span></div>
                <div class="tk-record-disc"><div class="tk-record-disc-inner"></div></div>
            </div>
            <div class="tk-bottom-info">
                <div class="tk-username">@${video.author}</div>
                <div class="tk-description">${video.desc}</div>
                <div class="tk-music-ticker">
                    <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    <div class="tk-marquee"><span>Original Sound - ${video.music || video.author}</span></div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

// 渲染 Profile 个人作品网格
function renderTkProfileFeed() {
    const grid = document.getElementById('tkProfileGrid');
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    if (!data.profile || data.profile.length === 0) return;

    grid.innerHTML = '';
    data.profile.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'tk-grid-item';
        item.innerHTML = `<div style="padding: 5px; font-size: 10px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;">[画面] ${video.videoContent || video.desc}</div>`;
        item.onclick = () => openTkProfileVideo(index); // 点击进入视频详情
        grid.appendChild(item);
    });
}

// 新增：打开个人作品视频详情
function openTkProfileVideo(index) {
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const video = data.profile[index];
    if (!video) return;

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    const authorName = char ? (char.netName || char.name) : 'User';

    const container = document.getElementById('tkProfileVideoContainer');
    container.innerHTML = `
        <div class="tk-video-item" style="height: 100%; width: 100%;">
            <div class="tk-video-content-display" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; padding: 20px; z-index: 1; pointer-events: none;">
                <div style="width: 250px; text-align: center; color: rgba(255,255,255,0.8); font-size: 16px; word-wrap: break-word; white-space: normal;">
                    [视频画面]<br>${video.videoContent || '无画面描述'}
                </div>
            </div>
            <div class="tk-right-actions" style="z-index: 2;">
                <div class="tk-avatar-wrapper"><div class="tk-avatar-plus">+</div></div>
                <div class="tk-action-item"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span class="tk-action-text">${video.likes}</span></div>
                <div class="tk-action-item" onclick="openTkComments('profile', ${index})"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/></svg><span class="tk-action-text">${video.commentsCount}</span></div>
                <div class="tk-action-item"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg><span class="tk-action-text">Save</span></div>
                <div class="tk-action-item"><svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11V5z"/></svg><span class="tk-action-text">Share</span></div>
                <div class="tk-record-disc"><div class="tk-record-disc-inner"></div></div>
            </div>
            <div class="tk-bottom-info" style="z-index: 2;">
                <div class="tk-username">@${authorName}</div>
                <div class="tk-description">${video.desc}</div>
                <div class="tk-music-ticker">
                    <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    <div class="tk-marquee"><span>Original Sound - ${authorName}</span></div>
                </div>
            </div>
        </div>
    `;
    
    // 恢复头像
    const avatarUrl = char && char.avatarUrl ? char.avatarUrl : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop';
    const avatarEls = container.querySelectorAll('.tk-avatar-wrapper, .tk-record-disc-inner');
    avatarEls.forEach(el => el.style.backgroundImage = `url('${avatarUrl}')`);

    document.getElementById('tkProfileVideoModal').classList.add('show');
}

function closeTkProfileVideo() {
    document.getElementById('tkProfileVideoModal').classList.remove('show');
}

// 渲染 Inbox 私信列表
function renderTkInbox() {
    const list = document.getElementById('tkInboxList');
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    if (!data.inbox || data.inbox.length === 0) return;

    list.innerHTML = '';
    data.inbox.forEach((msg, index) => {
        const item = document.createElement('div');
        item.className = 'tk-inbox-item';
        item.onclick = () => openTkChatRoom(index);
        item.innerHTML = `
            <div class="tk-inbox-avatar"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
            <div class="tk-inbox-info">
                <div class="tk-inbox-name">${msg.name}</div>
                <div class="tk-inbox-desc">${msg.lastMsg}</div>
            </div>
            <div class="tk-inbox-right">${msg.time || '1h'}</div>
        `;
        list.appendChild(item);
    });
}

// 打开评论区
function openTkComments(type, index) {
    const list = document.getElementById('tkCommentsList');
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    const video = data[type][index];
    if (!video || !video.comments) return;

    list.innerHTML = '';
    video.comments.forEach(c => {
        const item = document.createElement('div');
        item.className = 'tk-comment-item';
        item.innerHTML = `
            <div class="tk-comment-avatar"></div>
            <div class="tk-comment-content">
                <div class="tk-comment-user">${c.user}</div>
                <div class="tk-comment-text">${c.content}</div>
            </div>
        `;
        list.appendChild(item);
    });

    document.getElementById('tkCommentsPanel').classList.add('show');
}

function closeTkComments() {
    document.getElementById('tkCommentsPanel').classList.remove('show');
}

// 打开私信聊天室
function openTkChatRoom(index) {
    const historyEl = document.getElementById('tkChatHistory');
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    const chat = data.inbox[index];
    if (!chat || !chat.history) return;

    document.getElementById('tkChatTitle').innerText = chat.name;
    historyEl.innerHTML = '';

    chat.history.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = `tk-chat-bubble ${msg.role === 'me' ? 'tk-chat-right' : 'tk-chat-left'}`;
        bubble.innerText = msg.content;
        historyEl.appendChild(bubble);
    });

    document.getElementById('tkChatRoom').classList.add('show');
    setTimeout(() => { historyEl.scrollTop = historyEl.scrollHeight; }, 100);
}

function closeTkChatRoom() {
    document.getElementById('tkChatRoom').classList.remove('show');
}

// 打开相机页面 (点击加号触发)
function openTiktokCamera() {
    document.getElementById('tk-page-camera').classList.add('show');
}

// 关闭相机页面
function closeTiktokCamera() {
    document.getElementById('tk-page-camera').classList.remove('show');
}
// ==========================================
// 相机页面中间草稿箱逻辑 (左右翻看)
// ==========================================
let currentTkDraftIndex = 0;
let tkDraftsList = [];

function renderTkDrafts() {
    const dataStr = ChatDB.getItem(`tiktok_data_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    tkDraftsList = data.drafts || [];
    currentTkDraftIndex = 0;
    updateTkDraftDisplay();
}

function updateTkDraftDisplay() {
    const textEl = document.getElementById('tkCamDraftText');
    if (!textEl) return;
    
    if (tkDraftsList.length === 0) {
        textEl.innerText = "暂无草稿，请点击主页右上角生成";
    } else {
        textEl.innerText = tkDraftsList[currentTkDraftIndex].desc;
    }
}

function prevTkDraft() {
    if (tkDraftsList.length <= 1) return;
    currentTkDraftIndex = (currentTkDraftIndex - 1 + tkDraftsList.length) % tkDraftsList.length;
    updateTkDraftDisplay();
}

function nextTkDraft() {
    if (tkDraftsList.length <= 1) return;
    currentTkDraftIndex = (currentTkDraftIndex + 1) % tkDraftsList.length;
    updateTkDraftDisplay();
}
// ==========================================
// 查手机 - 备忘录 APP 交互逻辑
// ==========================================

// 打开备忘录 APP
function openPhoneNotes() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');
    document.getElementById('phoneNotesApp').classList.add('show');
    renderPhoneNotesList(); // 打开时尝试渲染已有数据
}

// 关闭备忘录 APP (点击大标题触发)
function closePhoneNotes() {
    document.getElementById('phoneNotesApp').classList.remove('show');
}

// 打开备忘录详情页
function openNoteDetail(index) {
    const dataStr = ChatDB.getItem(`phone_notes_${currentChatRoomCharId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const note = data[index];
    if (!note) return;

    const editor = document.getElementById('noteDetailEditor');
    editor.innerHTML = `
        <div class="note-editor-time">${note.detailTime}</div>
        <div class="note-editor-title">${note.detailTitle}</div>
        <div style="white-space: pre-wrap;">${note.detailContent}</div>
    `;

    document.getElementById('noteDetailPage').classList.add('show');
}

// 关闭备忘录详情页
function closeNoteDetail() {
    document.getElementById('noteDetailPage').classList.remove('show');
}

// 渲染备忘录列表
function renderPhoneNotesList() {
    const grid = document.getElementById('phoneNotesGrid');
    const dataStr = ChatDB.getItem(`phone_notes_${currentChatRoomCharId}`);
    
    if (!dataStr) {
        grid.innerHTML = '<div style="grid-column: 1 / 3; text-align: center; color: #888; font-size: 13px; margin-top: 40px;">点击右上角按钮生成备忘录内容</div>';
        return;
    }

    const data = JSON.parse(dataStr);
    grid.innerHTML = '';

    data.forEach((item, index) => {
        const folder = document.createElement('div');
        // 交替使用浅棕色和深棕色样式
        const styleClass = index % 2 === 0 ? 'notes-style-1' : 'notes-style-2';
        folder.className = `notes-folder-item ${styleClass}`;
        folder.onclick = () => openNoteDetail(index);
        
        folder.innerHTML = `
            <div class="notes-folder-icon-wrapper">
                <!-- 小熊耳朵 (在最底层) -->
                <div class="notes-bear-ear left"></div>
                <div class="notes-bear-ear right"></div>
                
                <div class="notes-folder-tab"></div>
                <div class="notes-folder-paper notes-folder-paper-1"></div>
                <div class="notes-folder-paper notes-folder-paper-2"></div>
                <div class="notes-folder-body">
                    <div class="notes-cute-face">
                        <div class="notes-eyes-row"><div class="notes-eye"></div><div class="notes-eye"></div></div>
                        <div class="notes-mouth-bg">
                            <div class="notes-mouth-line top"></div>
                            <div class="notes-mouth-line left"></div>
                            <div class="notes-mouth-line right"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="notes-folder-text-info">
                <div class="notes-folder-title">${item.title}</div>
                <div class="notes-folder-count">${item.count}</div>
            </div>
        `;
        grid.appendChild(folder);
    });
}

// 调用 API 生成备忘录数据
async function generatePhoneNotesAPI() {
    if (!currentChatRoomCharId) return;
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 1. 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 3. 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 4. 构建 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，生成你手机里“备忘录”APP的相关数据。
备忘录的内容应该非常私密、真实，可以包含你对 ${userName} 的吐槽、暗恋、计划，或者你自己的日常琐事、购物清单、日记等。
必须返回合法的 JSON 数组，包含 4-6 个文件夹（每个文件夹对应一篇详细的备忘录），结构如下：
[
  {
    "title": "文件夹标题(如: 购物清单)",
    "count": "3 个备忘录",
    "detailTitle": "备忘录详细标题",
    "detailTime": "2023年10月25日 14:30",
    "detailContent": "备忘录的具体内容，可以包含换行符\\n，内容要符合该角色的人设和日常生活。"
  }
]`;

    showToast('正在生成备忘录...', 'loading');

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
            ChatDB.setItem(`phone_notes_${currentChatRoomCharId}`, JSON.stringify(parsed));
            
            renderPhoneNotesList();
            hideToast();
            alert('备忘录数据生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}

// ==========================================
// 查手机 - Shopping APP 交互逻辑
// ==========================================

// 打开 Shopping APP
function openPhoneShop() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');
    
    // 动态加载当前角色的头像和名字到我的页面
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (char) {
        const avatarUrl = char.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop';
        const charName = char.netName || char.name || 'User';
        
        const profileAvatar = document.getElementById('shopProfileAvatar');
        if (profileAvatar) profileAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        
        const profileName = document.getElementById('shopProfileName');
        if (profileName) profileName.innerText = charName;
    }

    document.getElementById('phoneShopApp').classList.add('show');
    switchShopTab('home'); // 默认打开首页
    renderPhoneShop(); // 尝试渲染已有数据
}

// 关闭 Shopping APP (点击大标题触发)
function closePhoneShop() {
    document.getElementById('phoneShopApp').classList.remove('show');
}

// 切换底部 Tab
function switchShopTab(tabId) {
    // 隐藏所有页面
    document.querySelectorAll('.shop-page').forEach(page => {
        page.classList.remove('active');
    });
    // 取消所有导航高亮
    document.querySelectorAll('.shop-nav-item').forEach(nav => {
        nav.classList.remove('active');
    });

    // 显示目标页面并高亮导航
    document.getElementById('shop-page-' + tabId).classList.add('active');
    document.getElementById('shop-nav-' + tabId).classList.add('active');
}

// 渲染 Shopping APP 数据
function renderPhoneShop() {
    const dataStr = ChatDB.getItem(`phone_shop_${currentChatRoomCharId}`);
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    
    // 1. 渲染首页推荐
    const homeGrid = document.getElementById('shopHomeGrid');
    if (data.home && data.home.length > 0) {
        homeGrid.innerHTML = '';
        data.home.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';
            // 绑定点击事件，打开商品详情
            card.onclick = () => openShopItemDetail(item);
            card.innerHTML = `
                <div class="shop-item-img">
                    <div class="chat-desc-img-120" style="width: 100% !important; height: 100% !important; border: none; border-radius: 0;"><div class="img-text">${item.imageDesc}</div></div>
                </div>
                <div class="shop-item-info">
                    <div class="shop-item-title">${item.title}</div>
                    <div class="shop-item-bottom">
                        <div class="shop-item-price">${item.price}</div>
                        <div class="shop-item-add"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>
                    </div>
                </div>
            `;
            homeGrid.appendChild(card);
        });
    }

    // 2. 渲染购物车
    const cartList = document.getElementById('shopCartList');
    if (data.cart && data.cart.length > 0) {
        cartList.innerHTML = '';
        let total = 0;
        data.cart.forEach(item => {
            total += parseFloat(item.price) * (item.qty || 1);
            const card = document.createElement('div');
            card.className = 'shop-cart-item';
            card.onclick = () => openShopItemDetail(item); // 购物车商品也可以点击查看
            card.innerHTML = `
                <div class="shop-checkbox active" onclick="event.stopPropagation(); this.classList.toggle('active')"></div>
                <div class="shop-cart-img">
                    <div class="chat-desc-img-120" style="width: 100% !important; height: 100% !important; border: none; border-radius: 10px; padding: 4px;"><div class="img-text" style="font-size: 10px;">${item.imageDesc}</div></div>
                </div>
                <div class="shop-cart-info">
                    <div class="shop-cart-title">${item.title}</div>
                    <div class="shop-cart-sku">${item.sku || '默认规格'}</div>
                    <div class="shop-cart-price-row">
                        <div class="shop-cart-price">${item.price}</div>
                        <div class="shop-cart-qty" onclick="event.stopPropagation()"><span>-</span><span>${item.qty || 1}</span><span>+</span></div>
                    </div>
                </div>
            `;
            cartList.appendChild(card);
        });
        document.getElementById('shopCartTotal').innerText = `¥${total.toFixed(2)}`;
    }

    // 3. 渲染最近购买订单
    const orderList = document.getElementById('shopRecentOrdersList');
    if (data.orders && data.orders.length > 0) {
        orderList.innerHTML = '';
        data.orders.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-recent-order-item';
            card.onclick = () => openShopItemDetail(item); // 订单商品也可以点击查看
            card.innerHTML = `
                <div class="shop-recent-img">
                    <div class="chat-desc-img-120" style="width: 100% !important; height: 100% !important; border: none; border-radius: 8px; padding: 4px;"><div class="img-text" style="font-size: 10px;">${item.imageDesc}</div></div>
                </div>
                <div class="shop-recent-info">
                    <div class="shop-recent-title">${item.title}</div>
                    <div class="shop-recent-status">${item.status}</div>
                </div>
                <div class="shop-recent-price">¥${item.price}</div>
            `;
            orderList.appendChild(card);
        });
    }
}

// 调用 API 生成 Shopping 数据 (一次性生成所有商品及详情)
async function generatePhoneShopAPI() {
    if (!currentChatRoomCharId) return;
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 1. 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 3. 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 4. 构建 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，生成你手机里“Shopping (商城/外卖)”APP的相关数据。
商品内容应该符合该角色的消费习惯、兴趣爱好、经济水平，或者可能包含准备买给 ${userName} 的礼物。

【重要新增要求】：这个 APP 不仅可以买实物商品，还可以点外卖！请在生成的首页推荐、购物车、最近订单中，**务必混合包含一些外卖/餐饮相关的条目**（例如：奶茶、烧烤、炸鸡、咖啡、轻食等）。外卖订单的状态可以是“派送中”、“已送达”等。

【重要要求】：对于每一个商品或外卖，你必须同时生成一段详细的 "description" (商品详情)。
这段详情需要包含：
1. 商品的卖点、材质、口味、功能介绍（符合商城或外卖平台的语气）。
2. 买家秀评价（可以编造几个有趣的评价）。
3. 【最重要】：以 ${char.name} 的内心独白形式，写一段为什么想买这个东西的想法（比如：觉得很适合 ${userName} 想买来送礼，或者是自己最近刚好需要，或者是半夜饿了想吃宵夜）。

必须返回合法的 JSON 对象，结构如下：
{
  "home": [ // 首页推荐商品 (4-6个)
    {
      "title": "商品名称", 
      "price": "199.00", 
      "imageDesc": "图片画面的详细文字描述",
      "desc": "商品本身的卖点、材质、功能介绍等客观描述，可以使用 \\n 进行换行分段。",
      "reviews": [
        {"user": "买家A", "content": "评价内容..."}
      ],
      "thought": "角色想买这个东西的内心独白"
    }
  ],
  "cart": [ // 购物车商品 (1-3个)
    {
      "title": "商品名称", 
      "sku": "颜色/尺码等规格", 
      "price": "99.00", 
      "qty": 1, 
      "imageDesc": "图片画面的详细文字描述",
      "desc": "商品本身的卖点、材质、功能介绍等客观描述，可以使用 \\n 进行换行分段。",
      "reviews": [
        {"user": "买家A", "content": "评价内容..."}
      ],
      "thought": "角色想买这个东西的内心独白"
    }
  ],
  "orders": [ // 最近购买订单 (2-4个)
    {
      "title": "商品名称", 
      "status": "待发货/待收货/已完成", 
      "price": "299.00", 
      "imageDesc": "图片画面的详细文字描述",
      "desc": "商品本身的卖点、材质、功能介绍等客观描述，可以使用 \\n 进行换行分段。",
      "reviews": [
        {"user": "买家A", "content": "评价内容..."}
      ],
      "thought": "角色想买这个东西的内心独白"
    }
  ]
}`;

    showToast('正在生成商城数据(包含详情，请耐心等待)...', 'loading');

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
            ChatDB.setItem(`phone_shop_${currentChatRoomCharId}`, JSON.stringify(parsed));
            
            renderPhoneShop();
            hideToast();
            alert('商城数据生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}

// ==========================================
// 商品详情全屏页逻辑 (直接读取本地数据，秒开)
// ==========================================

function openShopItemDetail(item) {
    // 填充基础信息
    document.getElementById('shopDetailTitle').innerText = item.title;
    document.getElementById('shopDetailPrice').innerText = `¥${item.price}`;
    // 使用新的类名，解除文字省略限制，允许滚动
    document.getElementById('shopDetailImg').innerHTML = `<div class="shop-detail-full-text">${item.imageDesc}</div>`;
    
    // 处理新的结构化数据 (兼容旧数据)
    const descEl = document.getElementById('shopDetailDesc');
    const thoughtSection = document.getElementById('shopDetailThoughtSection');
    const thoughtContent = document.getElementById('shopDetailThought');
    const reviewSection = document.getElementById('shopDetailReviewSection');
    const reviewList = document.getElementById('shopDetailReviews');
    const reviewCount = document.getElementById('shopDetailReviewCount');

    // 重置显示状态
    thoughtSection.style.display = 'none';
    reviewSection.style.display = 'none';
    descEl.innerHTML = '';
    reviewList.innerHTML = '';

    if (item.desc || item.reviews || item.thought) {
        // 新数据格式
        if (item.thought) {
            thoughtContent.innerText = item.thought;
            thoughtSection.style.display = 'block';
        }
        
        if (item.reviews && item.reviews.length > 0) {
            reviewCount.innerText = `(${item.reviews.length})`;
            item.reviews.forEach(review => {
                const reviewItem = document.createElement('div');
                reviewItem.className = 'shop-detail-review-item';
                reviewItem.innerHTML = `
                    <div class="shop-detail-review-user">
                        <div class="shop-detail-review-avatar"></div>
                        <div class="shop-detail-review-name">${review.user}</div>
                    </div>
                    <div class="shop-detail-review-text">${review.content}</div>
                `;
                reviewList.appendChild(reviewItem);
            });
            reviewSection.style.display = 'block';
        }

        if (item.desc) {
            descEl.innerHTML = item.desc.replace(/\n/g, '<br>');
        } else {
            descEl.innerHTML = '<div style="color:#888;">暂无详细描述</div>';
        }
    } else if (item.description) {
        // 兼容旧数据格式
        descEl.innerHTML = item.description.replace(/\n/g, '<br>');
    } else {
        descEl.innerHTML = '<div style="color:#888;">暂无详细描述</div>';
    }
    
    // 显示全屏页
    document.getElementById('shopDetailPage').classList.add('show');
}

function closeShopItemDetail() {
    document.getElementById('shopDetailPage').classList.remove('show');
}

// 劫持 openPhoneShop，在打开时尝试渲染已有数据
const _originalOpenPhoneShop = openPhoneShop;
openPhoneShop = function() {
    _originalOpenPhoneShop();
    renderPhoneShop();
};
// ==========================================
// 查手机 - 相册与录音 APP 交互逻辑
// ==========================================

// 打开相册与录音 APP
function openPhoneGallery() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');

    document.getElementById('phoneGalleryApp').classList.add('show');
    switchPgTab('album'); // 默认打开相册页
    renderPhoneGallery(); // 尝试渲染已有数据
}

// 关闭相册与录音 APP
function closePhoneGallery() {
    document.getElementById('phoneGalleryApp').classList.remove('show');
}

// 切换底部 Tab
function switchPgTab(tabName) {
    // 隐藏所有页面，移除所有导航高亮
    document.querySelectorAll('.pg-page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.pg-nav-item:not(.pg-add-btn)').forEach(nav => nav.classList.remove('active'));

    // 显示目标页面，高亮目标导航
    document.getElementById('pg-page-' + tabName).classList.add('active');
    document.getElementById('pg-nav-' + tabName).classList.add('active');

    // 更改 Header 标题并带上淡入淡出动画
    const titleEl = document.getElementById('pg-header-title');
    titleEl.style.opacity = 0;
    setTimeout(() => {
        titleEl.innerText = tabName === 'album' ? 'Gallery' : 'Voice Memos';
        titleEl.style.opacity = 1;
    }, 200);
}

// 渲染相册与录音数据
function renderPhoneGallery() {
    const dataStr = ChatDB.getItem(`phone_gallery_${currentChatRoomCharId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);

    // 1. 渲染相册 Recent Memories (取前3个相册的封面)
    const stackEl = document.getElementById('pg-album-stack');
    if (stackEl && data.recentMemories && data.recentMemories.length > 0) {
        stackEl.innerHTML = '';
        const recent = data.recentMemories.slice(0, 3);
        recent.forEach((mem, idx) => {
            let zIndex = 3 - idx;
            let rotate = idx === 0 ? '-5deg' : (idx === 1 ? '2deg' : '8deg');
            let left = idx * 40 + 'px';
            // 增加 onclick 事件，点击打开弹窗
            stackEl.innerHTML += `
                <div class="chat-desc-img-120" onclick="openPgRecentDetail(${idx})" style="width: 100px !important; height: 100px !important; border-radius: 16px; border: 3px solid #2c2c2e; position: absolute; box-shadow: 0 10px 20px rgba(0,0,0,0.3); left: ${left}; z-index: ${zIndex}; transform: rotate(${rotate}); padding: 8px; background: #f0f0f0; cursor: pointer;">
                    <div class="img-text" style="font-size: 10px; color: #666;">${mem.desc}</div>
                </div>
            `;
        });
    }

    // 2. 渲染相册列表
    const gridEl = document.getElementById('pg-gallery-grid');
    if (gridEl && data.albums) {
        gridEl.innerHTML = '';
        data.albums.forEach((album, idx) => {
            gridEl.innerHTML += `
                <div class="pg-grid-item" onclick="openPgAlbumDetail(${idx})">
                    <div class="chat-desc-img-120 pg-grid-img" style="width: 100% !important; height: auto !important; aspect-ratio: 1; border-radius: 20px; padding: 10px; background: #eee; cursor: pointer;">
                        <div class="img-text" style="font-size: 12px; color: #555;">${album.coverDesc}</div>
                    </div>
                    <div class="pg-grid-info">
                        <span class="pg-grid-title">${album.title}</span>
                        <span class="pg-grid-count">${album.time}</span> <!-- 这里改成了显示时间 -->
                    </div>
                </div>
            `;
        });
    }

    // 3. 渲染录音列表
    const timelineEl = document.getElementById('pg-timeline-container');
    if (timelineEl && data.records) {
        timelineEl.innerHTML = '<div class="pg-timeline-line"></div>';
        data.records.forEach((record, idx) => {
            timelineEl.innerHTML += `
                <div class="pg-task-row" onclick="playPgRecord(${idx})">
                    <div class="pg-timeline-node" id="pg-record-node-${idx}"></div>
                    <div class="pg-task-card">
                        <div class="pg-task-header">
                            <div class="pg-task-title">${record.title}</div>
                            <div class="pg-task-time">${record.time}</div>
                        </div>
                        <div class="pg-task-desc">
                            <div class="pg-play-btn-small">
                                <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                            ${record.duration} • ${record.size}
                        </div>
                    </div>
                </div>
            `;
        });
    }
}

// 打开相册详情弹窗 (Albums)
function openPgAlbumDetail(index) {
    const dataStr = ChatDB.getItem(`phone_gallery_${currentChatRoomCharId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const album = data.albums[index];
    if (!album) return;

    document.getElementById('pgAlbumDetailTitle').innerText = album.title;
    document.getElementById('pgAlbumDetailCount').innerText = album.time;
    document.getElementById('pgAlbumDetailDesc').innerText = album.coverDesc;
    
    document.getElementById('pgAlbumDetailOverlay').classList.add('show');
}

// 打开最近照片详情弹窗 (Recent Memories)
function openPgRecentDetail(index) {
    const dataStr = ChatDB.getItem(`phone_gallery_${currentChatRoomCharId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const mem = data.recentMemories[index];
    if (!mem) return;

    document.getElementById('pgAlbumDetailTitle').innerText = "Recent Memory";
    document.getElementById('pgAlbumDetailCount').innerText = mem.time;
    document.getElementById('pgAlbumDetailDesc').innerText = mem.desc;
    
    document.getElementById('pgAlbumDetailOverlay').classList.add('show');
}

// 关闭相册详情弹窗
function closePgAlbumDetail() {
    document.getElementById('pgAlbumDetailOverlay').classList.remove('show');
}

// 播放录音联动
function playPgRecord(index) {
    const dataStr = ChatDB.getItem(`phone_gallery_${currentChatRoomCharId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    const record = data.records[index];
    if (!record) return;

    // 1. 更新顶部卡片信息
    document.getElementById('pg-record-hero-title').innerText = record.title;
    document.getElementById('pg-record-hero-time').innerText = record.duration;
    document.getElementById('pg-record-status-text').innerText = 'Playing';
    
    // 2. 更新录音具体内容
    const contentEl = document.getElementById('pg-record-hero-content');
    if (contentEl) {
        contentEl.innerText = `"${record.content}"`;
    }
    
    // 3. 开启波浪动画和红点闪烁
    document.getElementById('pg-sound-wave').classList.add('playing');
    document.getElementById('pg-record-dot').style.animation = 'pgPulse 1.5s infinite';
    document.getElementById('pg-record-dot').style.opacity = '1';

    // 4. 更新时间轴节点的高亮状态
    document.querySelectorAll('.pg-timeline-node').forEach(node => node.classList.remove('active'));
    const activeNode = document.getElementById(`pg-record-node-${index}`);
    if (activeNode) activeNode.classList.add('active');
}

// 调用 API 生成相册与录音数据
async function generatePhoneGalleryAPI() {
    if (!currentChatRoomCharId) return;
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 1. 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 3. 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 4. 构建 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，生成你手机里“相册(Gallery)”和“录音(Voice Memos)”APP的相关数据。
内容应该非常私密、真实，可以包含你对 ${userName} 的偷拍、合照、或者是你自己的日常照片；录音可以是你的随手记、唱歌、或者是想对 ${userName} 说的话。
{
  "recentMemories": [ // 3张最近的照片 (与下方相册内容不同)
    {
      "time": "照片时间(如: Today)",
      "desc": "照片画面的详细文字描述，例如：一张在咖啡馆偷拍 ${userName} 侧脸的照片"
    }
  ],
  "albums": [ // 4-6个相册文件夹
    {
      "title": "相册名称(如: Favorites, 偷拍的某人)",
      "time": "相册创建或最新更新时间(如: 2023-10-25)",
      "coverDesc": "相册封面的详细文字描述"
    }
  ],
  "records": [ // 3-5条录音记录
    {
      "title": "录音标题(如: 睡前想说的话, 随便哼的歌)",
      "time": "录音时间(如: Today, 9:00 AM 或 Yesterday, 8:30 PM)",
      "duration": "录音时长(如: 00:03:45)",
      "size": "文件大小(如: 2.4 MB)",
      "content": "录音的具体文本内容，比如角色的自言自语、哼唱的歌词等，要符合人设，字数在20-50字左右。"
    }
  ]
}`;

    showToast('正在生成数据...', 'loading');

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
            ChatDB.setItem(`phone_gallery_${currentChatRoomCharId}`, JSON.stringify(parsed));
            
            renderPhoneGallery();
            hideToast();
            alert('数据生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}
// ==========================================
// 查手机 - Browser APP 交互逻辑 (带本地存储)
// ==========================================
let browserTabs = [];
let browserActiveTabId = null;
let browserCurrentView = 'home';
let browserSearchHistoryData = [];

function openPhoneBrowser() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');
    
    // 1. 从本地存储读取数据
    const savedTabs = ChatDB.getItem(`browser_tabs_${currentChatRoomCharId}`);
    const savedHistory = ChatDB.getItem(`browser_history_${currentChatRoomCharId}`);

    if (savedTabs) {
        browserTabs = JSON.parse(savedTabs);
    } else {
        browserTabs = [{ id: Date.now(), history: ['home'], currentIndex: 0 }];
    }

    if (savedHistory) {
        browserSearchHistoryData = JSON.parse(savedHistory);
    } else {
        browserSearchHistoryData = [];
    }

    browserActiveTabId = browserTabs[0].id;
    browserCurrentView = 'home';

    document.getElementById('phoneBrowserApp').classList.add('show');
    
    // 2. 渲染界面
    browserRenderCurrentTab();
    renderBrowserHistory();
}

function closePhoneBrowser() {
    document.getElementById('phoneBrowserApp').classList.remove('show');
}

function browserNavigateTo(url) {
    let tab = browserTabs.find(t => t.id === browserActiveTabId);
    tab.history = tab.history.slice(0, tab.currentIndex + 1);
    tab.history.push(url);
    tab.currentIndex++;
    
    // 保存到本地
    ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
    browserRenderCurrentTab();
}

function browserRenderCurrentTab() {
    let tab = browserTabs.find(t => t.id === browserActiveTabId);
    let currentUrl = tab.history[tab.currentIndex];

    if (currentUrl === 'home') {
        browserSwitchView('home');
    } else {
        browserSwitchView('web');
        document.getElementById('browser-web-input').value = tab.title || currentUrl;
        
        // 渲染论坛帖子内容
        const forumContent = document.getElementById('browser-forum-content');
        if (tab.forumData) {
            let commentsHtml = '';
            if (tab.forumData.comments && tab.forumData.comments.length > 0) {
                commentsHtml = tab.forumData.comments.map(c => `
                    <div class="browser-forum-comment-item">
                        <div class="browser-forum-comment-avatar"></div>
                        <div class="browser-forum-comment-info">
                            <div class="browser-forum-comment-user">${c.user}</div>
                            <div class="browser-forum-comment-text">${c.text}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                commentsHtml = '<div style="color:#888; font-size:13px;">暂无评论</div>';
            }

            forumContent.innerHTML = `
                <div class="browser-forum-post">
                    <div class="browser-forum-title">${tab.forumData.title}</div>
                    <div class="browser-forum-body">${tab.forumData.content}</div>
                </div>
                <div class="browser-forum-comments-section">
                    <div class="browser-forum-comments-header">全部评论</div>
                    ${commentsHtml}
                </div>
            `;
        } else {
            forumContent.innerHTML = '<div style="padding: 20px; color: #888;">正在加载帖子内容...</div>';
        }
    }
    browserUpdateNavButtons();
    browserUpdateTabCount();
}

function browserSwitchView(viewName) {
    browserCurrentView = viewName;
    document.getElementById('browser-view-home').classList.remove('active');
    document.getElementById('browser-view-web').classList.remove('active');
    document.getElementById('browser-view-tabs').classList.remove('active');

    if (viewName === 'home') document.getElementById('browser-view-home').classList.add('active');
    if (viewName === 'web') document.getElementById('browser-view-web').classList.add('active');
    if (viewName === 'tabs') {
        document.getElementById('browser-view-tabs').classList.add('active');
        browserRenderTabGrid();
    }
}

function browserUpdateNavButtons() {
    let tab = browserTabs.find(t => t.id === browserActiveTabId);
    const btnBack = document.getElementById('browser-btn-back');
    const btnForward = document.getElementById('browser-btn-forward');
    
    if (tab.currentIndex > 0) {
        btnBack.classList.remove('disabled');
    } else {
        btnBack.classList.add('disabled');
    }

    if (tab.currentIndex < tab.history.length - 1) {
        btnForward.classList.remove('disabled');
    } else {
        btnForward.classList.add('disabled');
    }
}

function browserUpdateTabCount() {
    document.getElementById('browser-tab-count-display').innerText = browserTabs.length;
}

function browserGoBack() {
    let tab = browserTabs.find(t => t.id === browserActiveTabId);
    if (tab.currentIndex > 0) {
        tab.currentIndex--;
        ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
        browserRenderCurrentTab();
    }
}

function browserGoForward() {
    let tab = browserTabs.find(t => t.id === browserActiveTabId);
    if (tab.currentIndex < tab.history.length - 1) {
        tab.currentIndex++;
        ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
        browserRenderCurrentTab();
    }
}

function browserGoHome() {
    let tab = browserTabs.find(t => t.id === browserActiveTabId);
    if (tab.history[tab.currentIndex] !== 'home') {
        // 核心修改：不覆盖当前标签页，而是寻找已有的主页标签页或新建一个
        let homeTab = browserTabs.find(t => t.history[t.currentIndex] === 'home');
        if (homeTab) {
            browserActiveTabId = homeTab.id;
            ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
            browserRenderCurrentTab();
        } else {
            browserCreateNewTab();
        }
    } else {
        browserSwitchView('home');
    }
}

function browserToggleTabs() {
    if (browserCurrentView === 'tabs') {
        browserRenderCurrentTab(); // 退出标签管理
    } else {
        browserSwitchView('tabs'); // 进入标签管理
    }
}

function browserCreateNewTab() {
    let newTab = { id: Date.now(), history: ['home'], currentIndex: 0 };
    browserTabs.push(newTab);
    browserActiveTabId = newTab.id;
    ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
    browserRenderCurrentTab();
}

function browserSwitchToTab(id) {
    browserActiveTabId = id;
    browserRenderCurrentTab();
}

function browserCloseTab(event, id) {
    event.stopPropagation(); // 阻止触发切换标签事件
    if (browserTabs.length === 1) {
        // 如果是最后一个标签，直接重置为主页
        browserTabs[0] = { id: Date.now(), history: ['home'], currentIndex: 0 };
        browserActiveTabId = browserTabs[0].id;
        ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
        browserRenderCurrentTab();
        return;
    }

    let index = browserTabs.findIndex(t => t.id === id);
    browserTabs.splice(index, 1);
    
    // 如果关闭的是当前激活的标签，激活前一个或后一个
    if (browserActiveTabId === id) {
        browserActiveTabId = browserTabs[Math.max(0, index - 1)].id;
    }
    
    ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
    browserRenderTabGrid();
    browserUpdateTabCount();
}

function browserRenderTabGrid() {
    const tabGrid = document.getElementById('browser-tab-grid');
    tabGrid.innerHTML = '';
    browserTabs.forEach(tab => {
        let currentUrl = tab.history[tab.currentIndex];
        let title = tab.title ? tab.title : (currentUrl === 'home' ? '主页' : currentUrl);
        
        let card = document.createElement('div');
        card.className = `browser-tab-card ${tab.id === browserActiveTabId ? 'active-tab' : ''}`;
        card.onclick = () => browserSwitchToTab(tab.id);
        
        card.innerHTML = `
            <div class="browser-tab-card-header">
                <span class="browser-tab-card-title">${title}</span>
                <div class="browser-close-tab" onclick="browserCloseTab(event, ${tab.id})">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
            </div>
            <div class="browser-tab-card-content">
                ${currentUrl === 'home' ? 'Browser' : '论坛帖子'}
            </div>
        `;
        tabGrid.appendChild(card);
    });
}

// ==========================================
// 浏览器搜索记录与内心想法逻辑
// ==========================================

function showBrowserHistory() {
    const dropdown = document.getElementById('browserSearchHistoryDropdown');
    if (browserSearchHistoryData.length > 0) {
        dropdown.classList.add('show');
    }
}

function hideBrowserHistory() {
    document.getElementById('browserSearchHistoryDropdown').classList.remove('show');
}

function renderBrowserHistory() {
    const dropdown = document.getElementById('browserSearchHistoryDropdown');
    dropdown.innerHTML = '';
    
    if (browserSearchHistoryData.length === 0) {
        dropdown.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 12px; padding: 20px;">点击右上角生成搜索记录</div>';
        return;
    }

    browserSearchHistoryData.forEach(item => {
        const el = document.createElement('div');
        el.className = 'browser-history-item';
        
        const textEl = document.createElement('div');
        textEl.className = 'browser-history-text';
        textEl.innerText = item.keyword;
        
        // 点击整行，填入输入框并弹出想法
        el.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('browser-home-input').value = item.keyword;
            hideBrowserHistory();
            showBrowserThought(item.keyword, item.thought);
        };

        el.appendChild(textEl);
        dropdown.appendChild(el);
    });
}

function showBrowserThought(keyword, thoughtText) {
    document.getElementById('browserThoughtKeyword').innerText = "搜索内容：" + keyword;
    document.getElementById('browserThoughtText').innerText = "内心想法：" + thoughtText;
    document.getElementById('browserThoughtModalOverlay').classList.add('show');
}

function closeBrowserThoughtModal() {
    document.getElementById('browserThoughtModalOverlay').classList.remove('show');
}

// 调用 API 生成浏览器数据 (包含搜索记录和论坛帖子标签页)
async function generatePhoneBrowserAPI() {
    if (!currentChatRoomCharId) return;
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 1. 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 3. 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 4. 构建 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，生成你手机浏览器里的数据。
内容应该符合你的性格、职业、当前的烦恼，或者可能包含你为了 ${userName} 而去搜索的内容（比如查攻略、查礼物、查情感问题等）。

必须返回合法的 JSON 对象，包含 "history" (搜索记录) 和 "tabs" (保留的论坛帖子标签页)，结构如下：
{
  "history": [
    {
      "keyword": "搜索关键词(如: 附近好吃的火锅店)",
      "thought": "你搜索这个词时的内心真实想法(如: 听说这家店不错，下次带${userName}去吃看看)"
    }
  ],
  "tabs": [
    {
      "title": "帖子标题(如: 如何向喜欢的人自然地搭话 - 情感问答)",
      "content": "楼主的详细提问内容或帖子正文，可以包含换行符\\n",
      "comments": [
        {"user": "网友A", "text": "直接上啊！"},
        {"user": "网友B", "text": "先从共同话题聊起吧。"}
      ]
    }
  ]
}
注意：history 生成 4-6 条，tabs 生成 3-5 条。`;

    showToast('正在生成浏览器数据...', 'loading');

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
            
            const parsedData = JSON.parse(replyRaw);
            
            // 1. 处理搜索记录
            if (parsedData.history && Array.isArray(parsedData.history)) {
                browserSearchHistoryData = parsedData.history;
                ChatDB.setItem(`browser_history_${currentChatRoomCharId}`, JSON.stringify(browserSearchHistoryData));
                renderBrowserHistory();
            }
            
            // 2. 处理标签页 (论坛帖子)
            if (parsedData.tabs && Array.isArray(parsedData.tabs)) {
                browserTabs = parsedData.tabs.map((item, index) => ({
                    id: Date.now() + index,
                    history: ['home', `forum_${index}`], // 虚拟一个URL
                    currentIndex: 1, // 默认显示生成的网页
                    title: item.title,
                    forumData: item // 保存帖子数据
                }));
                ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
            }
            
            // 如果生成为空，给个默认主页
            if (browserTabs.length === 0) {
                browserTabs = [{ id: Date.now(), history: ['home'], currentIndex: 0 }];
                ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(browserTabs));
            }
            
            // 生成完毕后，强制保持在主页视图
            browserActiveTabId = browserTabs[0].id;
            browserSwitchView('home');
            browserUpdateNavButtons();
            browserUpdateTabCount();
            
            hideToast();
            alert('浏览器数据生成成功！点击搜索框可查看搜索记录。');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}

// ==========================================
// 查手机 - icity 日记 APP 交互逻辑
// ==========================================
function openPhoneIcity() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');
    
    // 动态加载当前角色的头像和名字
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (char) {
        const avatarUrl = char.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop';
        const charName = char.netName || char.name || 'User';
        
        const avatarEl = document.getElementById('icityAvatar');
        if (avatarEl) avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
        
        const handleEl = document.getElementById('icityHandle');
        if (handleEl) handleEl.innerText = '@' + charName;
    }

    document.getElementById('phoneIcityApp').classList.add('show');
}

function closePhoneIcity() {
    document.getElementById('phoneIcityApp').classList.remove('show');
}

// 渲染 icity 数据
function renderPhoneIcity() {
    const dataStr = ChatDB.getItem(`phone_icity_${currentChatRoomCharId}`);
    if (dataStr) {
        const data = JSON.parse(dataStr);
        document.getElementById('icityText').innerText = data.content || '暂无内容';
        document.getElementById('icityTimeText').innerText = data.time || '----/--/-- --:--';
    }
}

// 劫持 openPhoneIcity，在打开时尝试渲染已有数据
const _originalOpenPhoneIcity = openPhoneIcity;
openPhoneIcity = function() {
    _originalOpenPhoneIcity();
    renderPhoneIcity();
};

// 调用 API 生成 icity 日记数据
async function generatePhoneIcityAPI() {
    if (!currentChatRoomCharId) return;
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 1. 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 2. 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 3. 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 4. 构建 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，生成一篇你写在 "icity" (一个私密日记APP) 里的日记。
日记的内容应该非常私密、真实，反映你此刻最真实的内心活动、情绪波动，或者对 ${userName} 的看法、纠结、暗恋等。
语气要符合你的人设，不要像机器生成的，要像一个活人在深夜写下的碎碎念。

必须返回合法的 JSON 对象，结构如下：
{
  "content": "日记的具体内容，可以包含换行符\\n，字数必须在100字以上，禁止少于100字",
  "time": "写下这篇日记的时间，格式如：2025-11-14 21:52"
}`;

    showToast('正在生成日记...', 'loading');

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
            ChatDB.setItem(`phone_icity_${currentChatRoomCharId}`, JSON.stringify(parsed));
            
            renderPhoneIcity();
            hideToast();
            alert('日记生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。');
    }
}

// ==========================================
// 查手机 - 一键生成所有 APP 数据
// ==========================================
async function generateAllPhoneDataAPI() {
    if (!currentChatRoomCharId) return alert('请先进入聊天室！');
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请先配置 API！');

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === currentChatRoomCharId);
    if (!char) return;

    // 获取当前登录用户的面具 (Persona)
    const currentLoginId = ChatDB.getItem('current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));
    const userDesc = persona ? persona.persona : '普通用户';
    const userName = account ? (account.netName || 'User') : 'User';

    // 获取世界书
    let activeWbs = [];
    let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
    let entries = wbData.entries.filter(e => (char.wbEntries && char.wbEntries.includes(e.id)) || e.constant);
    entries.forEach(entry => {
        activeWbs.push(entry.content);
    });

    // 获取最近 30 条聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${currentChatRoomCharId}`) || '[]');
    let recentHistory = history.slice(-30).map(m => `${m.role === 'user' ? userName : char.name}: ${m.content}`).join('\n');

    // 构建超级 Prompt
    let prompt = `你现在正在扮演角色：${char.name}。\n`;
    prompt += `【你的设定】：${char.description || '无'}\n`;
    prompt += `【用户身份】：用户(${userName})在你的生活中的角色/人设是：${userDesc}。\n`;
    
    if (activeWbs.length > 0) {
        prompt += `【世界书背景】：\n${activeWbs.join('\n')}\n`;
    }
    
    if (recentHistory) {
        prompt += `【最近的聊天记录参考】：\n${recentHistory}\n`;
    }

    prompt += `\n请基于你的人设、当前生活状态，以及我们最近的聊天上下文，一次性生成你手机里所有 APP 的数据。
为了防止数据过大，请严格控制生成数量：
1. TikTok: 
   - foryou(推荐): 2条路人发布的视频(包含videoContent画面描述)。
   - profile(个人主页): 2条你自己发布的视频，画面(videoContent)和文案必须与 User(${userName}) 相关，表达你的真实情绪。
   - inbox(私信): 2条私信，内容必须是别人对你主页视频的搭讪或反应。
2. Notes(备忘录): 2篇日记/备忘。
3. Shop(商城): 2个首页推荐，1个购物车商品。
4. Gallery(相册): 2个相册，1条录音。
5. Browser(浏览器): 3条搜索记录，1个论坛帖子。
6. icity(私密日记): 1篇短日记。

必须返回合法的 JSON 对象，结构必须严格如下：
{
  "tiktok": {
    "foryou": [{"author": "路人", "videoContent": "画面描述", "desc": "文案", "likes": "10K", "commentsCount": "100", "music": "音乐", "comments": [{"user": "A", "content": "评论"}]}],
    "profile": [{"videoContent": "画面描述(与User相关)", "desc": "文案", "likes": "10K", "commentsCount": "100", "comments": [{"user": "A", "content": "评论"}]}],
    "inbox": [{"name": "发件人", "lastMsg": "消息", "time": "1h", "history": [{"role": "other", "content": "搭讪"}]}]
  },
  "notes": [
    { "title": "标题", "count": "1 个备忘录", "detailTitle": "详细标题", "detailTime": "时间", "detailContent": "内容" }
  ],
  "shop": {
    "home": [{"title": "商品", "price": "99", "imageDesc": "图片描述", "description": "详情"}],
    "cart": [{"title": "商品", "sku": "规格", "price": "99", "qty": 1, "imageDesc": "图片描述", "description": "详情"}]
  },
  "gallery": {
    "albums": [{"title": "相册名", "time": "时间", "coverDesc": "封面描述"}],
    "records": [{"title": "录音名", "time": "时间", "duration": "00:01:00", "size": "1MB", "content": "录音内容"}]
  },
  "browser": {
    "history": [{"keyword": "搜索词", "thought": "内心想法"}],
    "tabs": [{"title": "帖子标题", "content": "帖子内容", "comments": [{"user": "网友", "text": "评论"}]}]
  },
  "icity": {
    "content": "日记内容",
    "time": "时间"
  }
}`;

    document.getElementById('charSidebar').classList.remove('open');
    showToast('正在一键生成所有数据(耗时较长，请耐心等待)...', 'loading');

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
            
            // 分发数据到各个 APP 的存储中
            if (parsed.tiktok) ChatDB.setItem(`tiktok_data_${currentChatRoomCharId}`, JSON.stringify(parsed.tiktok));
            if (parsed.notes) ChatDB.setItem(`phone_notes_${currentChatRoomCharId}`, JSON.stringify(parsed.notes));
            if (parsed.shop) ChatDB.setItem(`phone_shop_${currentChatRoomCharId}`, JSON.stringify(parsed.shop));
            if (parsed.gallery) ChatDB.setItem(`phone_gallery_${currentChatRoomCharId}`, JSON.stringify(parsed.gallery));
            if (parsed.icity) ChatDB.setItem(`phone_icity_${currentChatRoomCharId}`, JSON.stringify(parsed.icity));
            
            if (parsed.browser) {
                if (parsed.browser.history) ChatDB.setItem(`browser_history_${currentChatRoomCharId}`, JSON.stringify(parsed.browser.history));
                if (parsed.browser.tabs) {
                    const tabs = parsed.browser.tabs.map((item, index) => ({
                        id: Date.now() + index,
                        history: ['home', `forum_${index}`],
                        currentIndex: 1,
                        title: item.title,
                        forumData: item
                    }));
                    ChatDB.setItem(`browser_tabs_${currentChatRoomCharId}`, JSON.stringify(tabs));
                }
            }
            
            hideToast();
            alert('所有 APP 数据一键生成成功！');
        } else {
            throw new Error('API 请求失败');
        }
    } catch (e) {
        hideToast();
        alert('生成失败，请检查 API 配置或重试。数据量过大可能导致超时。');
    }
}
