// ==========================================
// Music 模块专属逻辑 (music.js)
// ==========================================

const musicPanel = document.getElementById('musicPanel');
const musicLoginPanel = document.getElementById('musicLoginPanel');

// 音乐播放器核心实例
const audioPlayer = new Audio();
// 自动播放下一首
audioPlayer.addEventListener('ended', () => {
    playNextMusicSong(true); // 传入 true 表示自动切歌
});

let currentPlayingSong = null;

// ==========================================
// 👇 新增：系统级后台播放保活与锁屏控制逻辑 👇
// ==========================================
function updateSystemMediaSession() {
    if ('mediaSession' in navigator && currentPlayingSong) {
        // 处理封面 URL，确保获取高清大图以供锁屏显示
        let coverUrl = currentPlayingSong.cover || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg';
        if (coverUrl.includes('?param=')) {
            coverUrl = coverUrl.replace(/\?param=\d+y\d+/, '?param=512y512');
        } else if (coverUrl.includes('music.126.net')) {
            coverUrl += '?param=512y512';
        }

        // 1. 将当前歌曲信息推送到手机锁屏界面
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentPlayingSong.title || '未知歌曲',
            artist: currentPlayingSong.artist || '未知歌手',
            album: '小年糕 Music',
            artwork: [
                { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
                { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
                { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
                { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
                { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
                { src: coverUrl, sizes: '512x512', type: 'image/jpeg' }
            ]
        });

        // 2. 接管锁屏界面的播放控制按键，确保后台能切歌
        navigator.mediaSession.setActionHandler('play', () => {
            audioPlayer.play();
            const disc = document.querySelector('.mp-disc-outer');
            if (disc) disc.style.animationPlayState = 'running';
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            audioPlayer.pause();
            const disc = document.querySelector('.mp-disc-outer');
            if (disc) disc.style.animationPlayState = 'paused';
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            if (typeof playPrevMusicSong === 'function') playPrevMusicSong();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            if (typeof playNextMusicSong === 'function') playNextMusicSong();
        });
    }
}

// 监听音频被系统强行打断（如来电话），防止状态错乱
audioPlayer.addEventListener('pause', () => {
    const disc = document.querySelector('.mp-disc-outer');
    if (disc) disc.style.animationPlayState = 'paused';
});
// 👆 新增结束 👆

// 音乐 API 配置 (完全还原 script.js 逻辑)
let currentMusicSearchApi = localStorage.getItem('music_search_api') || 'primary';
let currentMusicPlayApi = localStorage.getItem('music_play_api') || 'miemie';

function getMusicSearchApiUrl() {
    if (currentMusicSearchApi === 'secondary') return 'https://ncmapi.btwoa.com';
    if (currentMusicSearchApi === 'tertiary') return 'https://ncm.zhenxin.me'; 
    if (currentMusicSearchApi === 'api4') return 'https://api-music.kingcola-icg.cn'; 
    if (currentMusicSearchApi === 'api5') return 'https://neteaseapi.gksm.store'; 
    return 'https://zm.wwoyun.cn'; // primary
}

function getMusicPlayApiUrl() {
    if (currentMusicPlayApi === 'zhizhi') return 'https://api.msls1441.com';
    return 'https://api.qijieya.cn/meting'; // miemie
}

// ==========================================
// 1. 登录与基础面板逻辑
// ==========================================
function openMusicApp() {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    if (musicLoginId) {
        // 核心修复：从所有实体中检查登录状态，防止 Char 刷新后被踢出
        let allEntities = getAllEntities();
        if (allEntities.some(a => a.id === musicLoginId)) {
            enterMusicMain();
            return;
        } else {
            // 账号已失效，清理残留状态
            ChatDB.removeItem('music_current_login_account');
            audioPlayer.pause();
            audioPlayer.src = '';
            currentPlayingSong = null;
            window.currentPlaylistTracks = [];
            const capsuleContainer = document.getElementById('globalMusicCapsuleContainer');
            if (capsuleContainer) capsuleContainer.style.display = 'none';
            isCapsuleVisible = false;
            localStorage.setItem('music_capsule_visible', 'false');
        }
    }
    renderMusicAccountList();
    musicLoginPanel.style.display = 'flex';
}

// 处理个人主页背景上传
function handleMusicMeBgUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = e.target.result;
            
            // 1. 先直接应用到页面上，保证立刻有反应
            const bgEl = document.getElementById('musicMeBg');
            if (bgEl) {
                bgEl.style.backgroundImage = `url('${imgUrl}')`;
            }
            
            // 2. 再尝试保存到本地数据库 (加 try-catch 防止图片太大爆内存报错)
            const musicLoginId = ChatDB.getItem('music_current_login_account');
            if (musicLoginId) {
                try {
                    ChatDB.setItem(`music_me_bg_${musicLoginId}`, imgUrl);
                } catch (err) {
                    console.warn("图片过大，无法持久化保存", err);
                    alert("图片体积过大，本次已应用，但可能无法永久保存。建议使用压缩后的图片。");
                }
            }
        }
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function renderMusicAccountList() {
    const listEl = document.getElementById('musicAccountSelectList');
    listEl.innerHTML = '';
    
    let allEntities = getAllEntities();
    let displayList = [];

    // 核心修改：只要是真实用户，或者是有账号密码的角色，都可以登录
    allEntities.forEach(entity => {
        if (entity.isAccount || (entity.account && entity.password)) {
            displayList.push(entity);
        }
    });

    if (displayList.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 13px; margin-top: 20px;">暂无可用账号，请先在 Chat 中注册或为角色生成私密账号</div>';
        return;
    }
    
    displayList.forEach(acc => {
        const isChar = !acc.isAccount;
        const typeTag = isChar ? '<span style="font-size:10px; background:#eee; color:#888; padding:2px 4px; border-radius:4px; margin-left:6px;">角色</span>' : '';
        
        const card = document.createElement('div');
        card.className = 'music-account-card';
        card.onclick = () => {
            ChatDB.setItem('music_current_login_account', acc.id);
            musicLoginPanel.style.display = 'none';
            enterMusicMain();
        };
        card.innerHTML = `
            <div class="music-account-avatar" style="background-image: url('${acc.avatarUrl || ''}')"></div>
            <div class="music-account-info">
                <div class="music-account-name">${acc.netName || acc.name || '未命名'}${typeTag}</div>
                <div class="music-account-id">${isChar ? 'Char Account: ' + acc.account : 'Account: ' + acc.account}</div>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function closeMusicLoginPanel() { musicLoginPanel.style.display = 'none'; }

function enterMusicMain() {
    renderMusicMePage();
    renderMusicFriends();
    musicPanel.style.display = 'flex';
}

function closeMusicPanel() { musicPanel.style.display = 'none'; }

function switchMusicTab(tabName) {
    document.querySelectorAll('.music-tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.music-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('music-page-' + tabName).classList.add('active');
    
    const btns = document.querySelectorAll('.music-nav-btn');
    const addFriendIcon = document.getElementById('music-header-add-friend');
    const settingsIcon = document.getElementById('music-header-settings');
    
    if (addFriendIcon) addFriendIcon.style.display = 'none';
    if (settingsIcon) settingsIcon.style.display = 'none';

    if(tabName === 'home') {
        btns[0].classList.add('active');
        // 【新增】：每次进入主页时拉取推荐歌单
        fetchMusicRecommendPlaylists();
    }
    if(tabName === 'friends') { 
        btns[1].classList.add('active'); 
        if (addFriendIcon) {
            addFriendIcon.style.display = 'block'; 
            addFriendIcon.style.stroke = '#ccc';
            addFriendIcon.style.strokeWidth = '3';
        }
        renderMusicFriends(); 
    }
    if(tabName === 'me') { 
        btns[2].classList.add('active'); 
        if (settingsIcon) settingsIcon.style.display = 'block'; 
        renderMusicMePage(); 
    }
}

// ==========================================
// 2. 个人主页与设置面板
// ==========================================
// 修改后 (music.js 约 130 行)
function renderMusicMePage() {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    if (!musicLoginId) return;
    
    // 核心修复：从所有实体中查找，这样 Char 登录时也能正确找到数据
    let allEntities = getAllEntities();
    const account = allEntities.find(a => a.id === musicLoginId);
    if (!account) return;

    document.getElementById('musicMeName').innerText = account.netName || account.name || '未命名';
    document.getElementById('musicMeAvatar').style.backgroundImage = account.avatarUrl ? `url(${account.avatarUrl})` : 'none';
    
    // 【修复】：读取并设置背景，防止刷新丢失
    const savedBg = ChatDB.getItem(`music_me_bg_${musicLoginId}`);
    const bgEl = document.getElementById('musicMeBg');
    if (bgEl) {
        if (savedBg) {
            bgEl.style.backgroundImage = `url('${savedBg}')`;
        } else {
            bgEl.style.backgroundImage = 'none';
            bgEl.style.backgroundColor = '#ccc';
        }
    }

    // 【新增】：动态计算关注、粉丝、时长
    let friends = JSON.parse(ChatDB.getItem(`music_friends_${musicLoginId}`) || '[]');
    let friendCount = friends.length;
    
    // 假设听歌时长保存在本地，每次播放累加（这里简单读取，如果没有则给个随机初始值）
    let listenTime = parseInt(ChatDB.getItem(`music_listen_time_${musicLoginId}`) || '0');
    if (listenTime === 0) {
        listenTime = Math.floor(Math.random() * 100) + 10; // 随机给点初始时长
        ChatDB.setItem(`music_listen_time_${musicLoginId}`, listenTime);
    }
    
    // 计算等级 (简单公式：时长 / 20)
    let level = Math.floor(listenTime / 20) + 1;
    if (level > 10) level = 10;

    // 更新 DOM
    const statsContainer = document.querySelector('#musicMeBg > div > div:nth-child(4)');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div><span>${friendCount}</span> 关注</div>
            <div><span>${friendCount}</span> 粉丝</div>
            <div>Lv.${level}</div>
            <div><span>${listenTime}</span> 小时</div>
        `;
    }
    
    const localBtn = document.getElementById('musicMeLocalBtn');
    if (localBtn) {
        if (account.isAccount) {
            localBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> 本地`;
            localBtn.onclick = openLocalImportModal;
        } else {
            localBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 最近`;
            localBtn.onclick = () => openCharRecentMusic(musicLoginId);
        }
    }
    
    renderMyPlaylists();
}

function updateMusicApiUI() {
    ['primary', 'secondary', 'tertiary', 'api4', 'api5'].forEach(api => {
        const el = document.getElementById(`api-search-${api}`);
        if (el) {
            el.style.color = currentMusicSearchApi === api ? '#007AFF' : '#111';
            el.innerHTML = currentMusicSearchApi === api ? `${el.innerText.replace(' ✓', '')} ✓` : el.innerText.replace(' ✓', '');
        }
    });
    ['miemie', 'zhizhi'].forEach(api => {
        const el = document.getElementById(`api-play-${api}`);
        if (el) {
            el.style.color = currentMusicPlayApi === api ? '#007AFF' : '#111';
            el.innerHTML = currentMusicPlayApi === api ? `${el.innerText.replace(' ✓', '')} ✓` : el.innerText.replace(' ✓', '');
        }
    });
}

function openMusicSettingsPanel() {
    updateMusicApiUI();
    document.getElementById('musicSettingsPanel').style.display = 'flex';
}

function closeMusicSettingsPanel() {
    document.getElementById('musicSettingsPanel').style.display = 'none';
}

function logoutMusicApp() {
    if (confirm('确定要退出当前音乐账号吗？')) {
        ChatDB.removeItem('music_current_login_account');
        
        // 1. 彻底清空播放状态与内存数据
        audioPlayer.pause();
        audioPlayer.src = '';
        currentPlayingSong = null;
        window.currentPlaylistTracks = [];
        window.parsedLyrics = [];
        window.currentPlayingLyric = "";
        
        // 2. 隐藏并重置悬浮胶囊和迷你播放器
        const capsuleContainer = document.getElementById('globalMusicCapsuleContainer');
        if (capsuleContainer) capsuleContainer.style.display = 'none';
        isCapsuleVisible = false;
        localStorage.setItem('music_capsule_visible', 'false');
        
        const miniPlayer = document.getElementById('miniMusicPlayer');
        if (miniPlayer) miniPlayer.style.display = 'none';
        isMiniPlayerExpanded = false;
        
        // 3. 结束一起听歌状态
        const statusEl = document.getElementById('mpListenTogetherStatus');
        if (statusEl) statusEl.style.display = 'none';
        if (typeof listenTogetherTimer !== 'undefined') {
            clearInterval(listenTogetherTimer);
            listenTogetherTimer = null; 
        }
        window.currentListenTogetherCharId = null;
        
        // 4. 恢复播放器默认 UI
        document.querySelector('.music-player-title').innerText = 'Not Playing';
        document.querySelector('.music-player-sub').innerText = 'Music App';
        document.querySelector('.music-player-disc-inner').style.backgroundImage = '';
        
        closeMusicSettingsPanel();
        musicPanel.style.display = 'none';
        openMusicApp(); 
    }
}

function musicSetSearchApi(api) {
    currentMusicSearchApi = api;
    localStorage.setItem('music_search_api', api);
    updateMusicApiUI(); 
}

function musicSetPlayApi(api) {
    currentMusicPlayApi = api;
    localStorage.setItem('music_play_api', api);
    updateMusicApiUI(); 
}

// ==========================================
// 3. 在线搜索与播放逻辑 (纯净原生 Fetch)
// ==========================================
function musicHandleSearchEnter(e) {
    if (e.key === 'Enter') {
        musicPerformSearch();
    }
}

async function musicPerformSearch() {
    const kw = document.getElementById('music-search-input').value.trim();
    const resultsContainer = document.getElementById('music-search-results');
    const banner = document.getElementById('music-home-banner');
    
    // 新增：控制取消按钮的显示
    const cancelBtn = document.getElementById('music-search-cancel');
    if (cancelBtn) {
        cancelBtn.style.display = kw ? 'block' : 'none';
    }
    
    // 隐藏其他区域，实现全屏搜索
    const navIcons = document.querySelector('.music-nav-icons');
    const playlistGrid = document.querySelector('.music-playlist-grid');
    const sectionTitle = document.querySelector('.music-section-title');
    
    if (navIcons) navIcons.style.display = kw ? 'none' : 'flex';
    if (playlistGrid) playlistGrid.style.display = kw ? 'none' : 'grid';
    if (sectionTitle) sectionTitle.style.display = kw ? 'none' : 'flex';
    
    if (!kw) {
        resultsContainer.innerHTML = '';
        banner.style.display = 'flex';
        return;
    }

    banner.style.display = 'none';
    resultsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888; font-size:13px;">正在搜索...</div>';

    try {
        const baseUrl = getMusicSearchApiUrl();
        const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(kw)}&timestamp=${Date.now()}`);
        const data = await res.json();
        
        console.log("搜索结果:", data); 
        
        if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
            resultsContainer.innerHTML = '';
            data.result.songs.forEach(song => {
                const title = song.name;
                const artist = song.ar ? song.ar.map(a => a.name).join(', ') : '未知歌手';
                const cover = (song.al && song.al.picUrl) ? song.al.picUrl + '?param=100y100' : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100';
                
                const item = document.createElement('div');
                item.className = 'music-song-item';
                item.onclick = () => musicPlaySong(song.id, title, artist, cover);
                // 【修改】：增加一个加号按钮用于添加到歌单
                item.innerHTML = `
                    <img src="${cover}" class="music-song-cover">
                    <div class="music-song-info">
                        <div class="music-song-title">${title}</div>
                        <div class="music-song-artist">${artist}</div>
                    </div>
                    <div class="music-song-action" onclick="event.stopPropagation(); openAddToPlaylistModal('${song.id}', '${title.replace(/'/g, "\\'")}', '${artist.replace(/'/g, "\\'")}', '${cover}')" style="background: #f0f0f0; color: #333; margin-right: 5px; padding: 6px 10px;">+</div>
                    <div class="music-song-action">播放</div>
                `;
                resultsContainer.appendChild(item);
            });
        } else {
            resultsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888; font-size:13px;">未找到相关歌曲</div>';
        }
    } catch (e) {
        console.error("Search Error:", e);
        resultsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#ff3b30; font-size:13px;">搜索失败，请尝试切换音源</div>';
    }
}

window.currentPlayingLyric = ""; // 全局保存当前歌词供 AI 读取

window.parsedLyrics = []; 

function parseLrc(lrc) {
    const lines = lrc.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (let line of lines) {
        const match = timeReg.exec(line);
        if (match) {
            const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / (match[3].length === 3 ? 1000 : 100);
            const text = line.replace(timeReg, '').trim();
            if (text) result.push({ time, text });
        }
    }
    return result;
}

async function musicPlaySong(id, title, artist, cover) {
    try {
        document.querySelector('.music-player-title').innerText = title;
        document.querySelector('.music-player-sub').innerText = artist;
        document.querySelector('.music-player-disc-inner').style.backgroundImage = `url(${cover})`;
        document.querySelector('.music-player-disc-inner').style.backgroundSize = 'cover';
        
        const mpSongName = document.getElementById('mpSongName');
        if (mpSongName) mpSongName.innerText = title;
        const mpArtistName = document.getElementById('mpArtistName');
        if (mpArtistName) mpArtistName.innerText = artist;
        const mpDiscCover = document.getElementById('mpDiscCover');
        if (mpDiscCover) mpDiscCover.style.backgroundImage = `url(${cover})`;
        
        const mpLyricTitle = document.getElementById('mpLyricTitle');
        if (mpLyricTitle) mpLyricTitle.innerText = title;
        const mpLyricArtist = document.getElementById('mpLyricArtist');
        if (mpLyricArtist) mpLyricArtist.innerText = artist;
        
        currentPlayingSong = { id, title, artist, cover };

        // 异步获取歌词并解析 (使用播放源 API)
        fetch(`${getMusicPlayApiUrl()}/?server=netease&type=lrc&id=${id}`).then(res => res.text()).then(textData => {
            const lyricContent = document.getElementById('mpLyricContent');
            const miniLyric = document.getElementById('miniPlayerLyric');
            
            let rawLrc = "";
            try {
                const jsonData = JSON.parse(textData);
                if (jsonData.lrc && jsonData.lrc.lyric) rawLrc = jsonData.lrc.lyric;
                else if (jsonData.lyric) rawLrc = jsonData.lyric;
                else rawLrc = textData;
            } catch (e) {
                rawLrc = textData;
            }

            if (rawLrc) {
                window.currentPlayingLyric = rawLrc.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
                window.parsedLyrics = parseLrc(rawLrc);
                if (lyricContent) {
                    lyricContent.innerHTML = window.parsedLyrics.map((line, idx) => `<div class="lyric-line" id="lrc-line-${idx}">${line.text}</div>`).join('');
                    lyricContent.scrollTop = 0;
                }
            } else {
                window.parsedLyrics = [];
                if (lyricContent) lyricContent.innerHTML = "暂无歌词数据";
                if (miniLyric) miniLyric.innerText = "享受纯净音乐";
            }
        }).catch(e => {
            console.error("获取歌词失败", e);
            window.parsedLyrics = [];
            const lyricContent = document.getElementById('mpLyricContent');
            if (lyricContent) lyricContent.innerHTML = "暂无歌词数据";
        });

        const playBaseUrl = getMusicPlayApiUrl();
        const res = await fetch(`${playBaseUrl}/?server=netease&type=song&id=${id}`);
        const data = await res.json();
        
        let songUrl = '';
        if (data && data.length > 0) {
            if (data[0].url) songUrl = data[0].url.replace('http://', 'https://');
            if (data[0].title) title = data[0].title;
            if (data[0].author) artist = data[0].author;
            if (data[0].pic) cover = data[0].pic;
        }
        
        if (songUrl) {
            audioPlayer.src = songUrl;
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    const disc = document.querySelector('.mp-disc-outer');
                    if (disc) disc.style.animationPlayState = 'running';
                    const playerPanel = document.getElementById('musicPlayerPanel');
                    if (playerPanel) {
                        const musicLoginId = ChatDB.getItem('music_current_login_account');
                        const savedBg = musicLoginId ? ChatDB.getItem(`music_player_bg_${musicLoginId}`) : null;
                        if (!savedBg) {
                            playerPanel.style.backgroundImage = `url('${cover}')`;
                        }
                    }
                    
                    // 👇 核心注入：每次成功播放新歌，立刻更新系统锁屏状态，确立后台霸权
                    updateSystemMediaSession();
                    // 【修复】：同步更新悬浮胶囊和迷你播放器的 UI
                    if (typeof updateCapsuleUI === 'function') updateCapsuleUI();
                    
                }).catch(e => {
                    if (e.name !== 'AbortError') {
                        alert(`《${title}》可能是 VIP 专属或无版权，无法自动播放。`);
                    }
                });
            }
        }
    } catch (e) {
        console.error("Play Error:", e);
    }
}

// ==========================================
// 4. 歌单管理 (新建、本地封面、URL导入、UID导入)
// ==========================================
let tempLocalCoverBase64 = null;

function renderMyPlaylists() {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    const container = document.getElementById('music-my-playlist-container');
    if (!container || !musicLoginId) return;
    
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    container.innerHTML = '';
    
    // 1. 渲染已有的歌单
    savedPlaylists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'music-pl-item';
        // 【修改】：点击整个歌单进入详情页
        div.onclick = () => openPlaylistDetail(pl.id);
        // 【修复】：判断如果是本地 base64 图片，就不加网易云的压缩参数
        const displayCover = pl.cover.startsWith('data:image') ? pl.cover : pl.cover + '?param=100y100';
        div.innerHTML = `
            <div class="music-pl-cover" style="background-image: url('${displayCover}');"></div>
            <div class="music-pl-info">
                <div class="music-pl-title">${pl.name}</div>
                <div class="music-pl-sub">歌单 · ${pl.trackCount || 0}首</div>
            </div>
            <!-- 【修改】：点击右侧图标打开编辑弹窗，并阻止冒泡 -->
            <div class="music-pl-action" onclick="event.stopPropagation(); openEditPlaylistModal('${pl.id}')">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#ccc"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
            </div>
        `;
        container.appendChild(div);
    });

    // 2. 渲染“新建歌单”按钮
    const createDiv = document.createElement('div');
    createDiv.className = 'music-pl-item';
    createDiv.onclick = () => {
        document.getElementById('music-create-pl-name').value = '';
        document.getElementById('music-create-pl-cover').value = '';
        tempLocalCoverBase64 = null;
        document.getElementById('musicCreatePlaylistModal').classList.add('show');
    };
    createDiv.innerHTML = `
        <div class="music-pl-cover">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#aaa" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div class="music-pl-info">
            <div class="music-pl-title">新建歌单</div>
        </div>
    `;
    container.appendChild(createDiv);

    // 3. 渲染“导入外部歌单”按钮
    const importDiv = document.createElement('div');
    importDiv.className = 'music-pl-item';
    importDiv.onclick = () => {
        // 【修改】：改为弹出选择弹窗
        document.getElementById('musicImportSelectModal').classList.add('show');
    };
    importDiv.innerHTML = `
        <div class="music-pl-cover">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#aaa" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <div class="music-pl-info">
            <div class="music-pl-title">导入外部歌单</div>
            <div class="music-pl-sub">轻松导入其他APP里的歌单</div>
        </div>
    `;
    container.appendChild(importDiv);
}

// 处理本地封面上传
function musicHandleLocalCoverUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempLocalCoverBase64 = e.target.result;
            document.getElementById('music-create-pl-cover').value = '已选择本地图片';
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function musicCreatePlaylist() {
    const name = document.getElementById('music-create-pl-name').value.trim();
    const coverUrl = document.getElementById('music-create-pl-cover').value.trim();
    
    if (!name) return alert("请输入歌单标题！");

    let finalCover = 'https://p2.music.126.net/6y-7YvS_G8V8.jpg'; // 默认封面
    if (tempLocalCoverBase64) {
        finalCover = tempLocalCoverBase64;
    } else if (coverUrl && coverUrl !== '已选择本地图片') {
        finalCover = coverUrl;
    }

    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    
    savedPlaylists.push({
        id: Date.now().toString(),
        name: name,
        cover: finalCover,
        trackCount: 0,
        tracks: []
    });
    
    ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
    document.getElementById('musicCreatePlaylistModal').classList.remove('show');
    renderMyPlaylists();
}

// 方式一：URL 链接导入单歌单
async function musicImportByUrl() {
    const inputVal = document.getElementById('music-import-url-input').value.trim();
    if (!inputVal) return alert("请输入网易云歌单链接或 ID！");

    let plId = "";
    const idMatch = inputVal.match(/id=(\d+)/);
    if (idMatch) {
        plId = idMatch[1];
    } else if (/^\d+$/.test(inputVal)) {
        plId = inputVal;
    } else {
        return alert("无法识别歌单 ID，请检查链接格式。");
    }

    const btn = document.getElementById('music-btn-import-url');
    const originalText = btn.innerText;
    btn.innerText = "解析中...";
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";

    try {
        const baseUrl = getMusicSearchApiUrl();
        const timestamp = Date.now();
        
        const resDetail = await fetch(`${baseUrl}/playlist/detail?id=${plId}&timestamp=${timestamp}`);
        const dataDetail = await resDetail.json();
        
        console.log("URL导入歌单详情:", dataDetail);
        
        if (dataDetail.code === 200 && dataDetail.playlist) {
            const resTracks = await fetch(`${baseUrl}/playlist/track/all?id=${plId}&limit=1000&timestamp=${timestamp}`);
            const dataTracks = await resTracks.json();
            
            let tracks = [];
            if (dataTracks.code === 200 && dataTracks.songs) {
                tracks = dataTracks.songs.map(song => ({
                    id: song.id,
                    title: song.name,
                    artist: song.ar ? song.ar.map(a => a.name).join(', ') : '未知歌手',
                    cover: (song.al && song.al.picUrl) ? song.al.picUrl + '?param=100y100' : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100'
                }));
            }
            
            const musicLoginId = ChatDB.getItem('music_current_login_account');
            let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');

            const exists = savedPlaylists.find(p => p.id === dataDetail.playlist.id);
            if (!exists) {
                savedPlaylists.push({
                    id: dataDetail.playlist.id,
                    name: dataDetail.playlist.name,
                    cover: dataDetail.playlist.coverImgUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg',
                    trackCount: tracks.length,
                    tracks: tracks
                });
                ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
                renderMyPlaylists();
                alert("导入成功！");
                document.getElementById('musicImportModal').classList.remove('show');
            } else {
                alert("该歌单已存在，请勿重复导入！");
            }
        } else {
            alert("获取歌单详情失败，请确保歌单已在网易云设置为公开！");
        }
    } catch (e) {
        console.error("URL Import Error:", e);
        alert("导入失败，网络异常或接口不可用。");
    } finally {
        btn.innerText = originalText;
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
    }
}

// ==========================================
// 【新增】：本地导入歌曲逻辑
// ==========================================
let localImportMode = 'url'; // 'url' 或 'file'

function openLocalImportModal() {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    if (!musicLoginId) return alert("请先登录音乐账号");
    
    // 渲染歌单下拉框
    const select = document.getElementById('localImportPlaylistSelect');
    select.innerHTML = '<option value="">请选择要添加到的歌单</option>';
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    savedPlaylists.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.innerText = pl.name;
        select.appendChild(opt);
    });

    // 重置表单
    document.getElementById('localImportUrlInput').value = '';
    document.getElementById('localImportFileInput').value = '';
    document.getElementById('localImportFileName').innerText = '未选择';
    document.getElementById('localImportName').value = '';
    document.getElementById('localImportArtist').value = '';
    document.getElementById('localImportLrcInput').value = '';
    document.getElementById('localImportLrcName').innerText = '未选择';
    
    switchLocalImportTab('url');
    document.getElementById('musicLocalImportModal').classList.add('show');
}

function switchLocalImportTab(mode) {
    localImportMode = mode;
    const tabUrl = document.getElementById('localImportTabUrl');
    const tabFile = document.getElementById('localImportTabFile');
    const inputUrl = document.getElementById('localImportUrlInput');
    const inputFile = document.getElementById('localImportFileArea');
    
    if (mode === 'url') {
        tabUrl.style.background = '#111'; tabUrl.style.color = '#fff';
        tabFile.style.background = '#f0f0f0'; tabFile.style.color = '#333';
        inputUrl.style.display = 'block';
        inputFile.style.display = 'none';
    } else {
        tabFile.style.background = '#111'; tabFile.style.color = '#fff';
        tabUrl.style.background = '#f0f0f0'; tabUrl.style.color = '#333';
        inputUrl.style.display = 'none';
        inputFile.style.display = 'flex';
    }
}

function confirmLocalImport() {
    const name = document.getElementById('localImportName').value.trim();
    const artist = document.getElementById('localImportArtist').value.trim() || '未知歌手';
    const playlistId = document.getElementById('localImportPlaylistSelect').value;
    
    if (!name) return alert("请输入歌名！");
    if (!playlistId) return alert("请选择要添加到的歌单！");

    let songUrl = '';
    if (localImportMode === 'url') {
        songUrl = document.getElementById('localImportUrlInput').value.trim();
        if (!songUrl) return alert("请输入歌曲 URL！");
        saveLocalSongToPlaylist(playlistId, name, artist, songUrl);
    } else {
        const fileInput = document.getElementById('localImportFileInput');
        if (!fileInput.files || fileInput.files.length === 0) return alert("请选择音频文件！");
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            songUrl = e.target.result; // Base64
            saveLocalSongToPlaylist(playlistId, name, artist, songUrl);
        };
        reader.readAsDataURL(file);
    }
}

function saveLocalSongToPlaylist(playlistId, name, artist, songUrl) {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    
    const plIndex = savedPlaylists.findIndex(p => p.id === playlistId);
    if (plIndex !== -1) {
        const newSong = {
            id: 'local_' + Date.now(),
            title: name,
            artist: artist,
            url: songUrl,
            cover: 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100' // 默认封面
        };
        
        // 处理歌词 (如果有)
        const lrcInput = document.getElementById('localImportLrcInput');
        if (lrcInput.files && lrcInput.files.length > 0) {
            const lrcReader = new FileReader();
            lrcReader.onload = function(e) {
                newSong.lrc = e.target.result;
                savedPlaylists[plIndex].tracks.push(newSong);
                savedPlaylists[plIndex].trackCount = savedPlaylists[plIndex].tracks.length;
                ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
                alert("导入成功！");
                document.getElementById('musicLocalImportModal').classList.remove('show');
                renderMyPlaylists();
            };
            lrcReader.readAsText(lrcInput.files[0]);
        } else {
            savedPlaylists[plIndex].tracks.push(newSong);
            savedPlaylists[plIndex].trackCount = savedPlaylists[plIndex].tracks.length;
            ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
            alert("导入成功！");
            document.getElementById('musicLocalImportModal').classList.remove('show');
            renderMyPlaylists();
        }
    }
}

// 方式二：UID 批量导入
async function musicDoWyyLogin() {
    // 【修改】：从新的仿网易云弹窗中获取 UID
    let uid = document.getElementById('wyy-uid-input-modal').value.trim();
    if (!uid) return alert("请输入网易云 UID！");
    
    const btn = document.getElementById('wyy-login-btn');
    const originalText = btn.innerText;
    btn.innerText = "获取中...";
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";
    
    try {
        const baseUrl = getMusicSearchApiUrl();
        const timestamp = Date.now(); 
        
        const plRes = await fetch(`${baseUrl}/user/playlist?uid=${uid}&timestamp=${timestamp}`);
        const plJson = await plRes.json();
        
        console.log("UID导入歌单列表:", plJson);
        
        if (plJson.code === 200 && plJson.playlist) {
            const musicLoginId = ChatDB.getItem('music_current_login_account');
            let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
            
            const maxImport = Math.min(plJson.playlist.length, 10);
            let successCount = 0;
            
            for (let i = 0; i < maxImport; i++) {
                const pl = plJson.playlist[i];
                if (!savedPlaylists.some(p => p.id === pl.id)) {
                    // UID 导入时，顺便把歌曲也拉下来，防止点进去没歌
                    try {
                        const resTracks = await fetch(`${baseUrl}/playlist/track/all?id=${pl.id}&limit=1000&timestamp=${timestamp}`);
                        const dataTracks = await resTracks.json();
                        let tracks = [];
                        if (dataTracks.code === 200 && dataTracks.songs) {
                            tracks = dataTracks.songs.map(song => ({
                                id: song.id,
                                title: song.name,
                                artist: song.ar ? song.ar.map(a => a.name).join(', ') : '未知歌手',
                                cover: (song.al && song.al.picUrl) ? song.al.picUrl + '?param=100y100' : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100'
                            }));
                        }
                        
                        savedPlaylists.push({
                            id: pl.id,
                            name: pl.name,
                            cover: pl.coverImgUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg',
                            trackCount: tracks.length,
                            tracks: tracks
                        });
                        successCount++;
                    } catch (err) {
                        console.warn(`歌单 ${pl.name} 歌曲拉取失败`, err);
                    }
                }
            }
            
            ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
            renderMyPlaylists();
            document.getElementById('musicWyyLoginModal').classList.remove('show');
            alert(`成功获取并保存了 ${successCount} 个歌单！`);
        } else {
            alert("获取歌单失败，请检查 UID 是否正确或切换音源。");
        }
    } catch (e) {
        console.error("UID Import Error:", e);
        alert("网络请求失败，请切换搜索接口。");
    } finally {
        btn.innerText = originalText;
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
    }
}

// ==========================================
// 5. 音乐好友与一起听歌逻辑
// ==========================================
function renderMusicFriends() {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    if (!musicLoginId) return;

    const listContainer = document.getElementById('musicFriendListContainer');
    listContainer.innerHTML = '';

    let friends = JSON.parse(ChatDB.getItem(`music_friends_${musicLoginId}`) || '[]');
    // 核心修复：使用 getAllEntities 包含所有用户和角色，防止 Char 登录时找不到 User 好友
    let allEntities = getAllEntities();

    if (friends.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #aaa; font-size: 13px;">暂无好友，快去添加吧</div>';
        return;
    }

    friends.forEach(charId => {
        const char = allEntities.find(c => c.id === charId);
        if (!char) return;

        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px 15px; background: #fff; border-radius: 16px; border: 1px solid #eee; box-shadow: 0 2px 10px rgba(0,0,0,0.02); cursor: pointer;';
        
        // 如果对方是角色，点击进入角色音乐主页
        if (!char.isAccount) {
            item.onclick = () => openMusicCharProfile(char.id);
        }
        
        item.innerHTML = `
            <div style="width: 44px; height: 44px; border-radius: 12px; background-image: url('${char.avatarUrl || ''}'); background-size: cover; background-position: center; background-color: #f4f4f4; border: 1px solid #eee;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <div style="font-size: 15px; font-weight: bold; color: #111;">${char.netName || char.name}</div>
                <div style="font-size: 12px; color: #888;">在线</div>
            </div>
            <div onclick="event.stopPropagation(); inviteListenTogether('${char.id}', '${char.netName || char.name}')" style="font-size: 11px; font-weight: bold; color: #111; background: #f4f4f4; padding: 6px 12px; border-radius: 10px; cursor: pointer;">一起听</div>
        `;
        listContainer.appendChild(item);
    });
}

function openMusicAddFriendModal() {
    document.getElementById('musicSearchFriendInput').value = '';
    document.getElementById('musicSearchResult').innerHTML = '';
    document.getElementById('musicAddFriendModalOverlay').classList.add('show');
}

function closeMusicAddFriendModal() {
    document.getElementById('musicAddFriendModalOverlay').classList.remove('show');
}

function searchMusicFriend() {
    const keyword = document.getElementById('musicSearchFriendInput').value.trim();
    const resultContainer = document.getElementById('musicSearchResult');
    
    if (!keyword) { resultContainer.innerHTML = ''; return; }

    // 核心修复：从所有实体中搜索，让 Char 也能搜到 User 账号
    let allEntities = getAllEntities();
    const currentLoginId = ChatDB.getItem('music_current_login_account');
    
    // 过滤掉自己，并且匹配账号
    const matchedChars = allEntities.filter(c => c.id !== currentLoginId && c.account && c.account.includes(keyword));

    if (matchedChars.length === 0) {
        resultContainer.innerHTML = '<div style="text-align: center; color: #aaa; font-size: 12px; padding: 20px;">未找到该账号</div>';
        return;
    }

    resultContainer.innerHTML = '';
    matchedChars.forEach(char => {
        const card = document.createElement('div');
        card.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: #f9f9f9; border-radius: 12px; border: 1px solid #eee;';
        card.innerHTML = `
            <div style="width: 40px; height: 40px; border-radius: 10px; background-image: url('${char.avatarUrl || ''}'); background-size: cover; background-position: center; background-color: #eee;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <div style="font-size: 14px; font-weight: bold; color: #111;">${char.netName || char.name}</div>
                <div style="font-size: 11px; color: #888;">账号: ${char.account}</div>
            </div>
            <div onclick="addMusicFriend('${char.id}')" style="background: #111; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer;">添加</div>
        `;
        resultContainer.appendChild(card);
    });
}

function addMusicFriend(charId) {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    if (!musicLoginId) return;

    // 1. 添加到自己的好友列表
    let friends = JSON.parse(ChatDB.getItem(`music_friends_${musicLoginId}`) || '[]');
    if (friends.includes(charId)) { alert('该角色已经是您的音乐好友了！'); return; }

    friends.push(charId);
    ChatDB.setItem(`music_friends_${musicLoginId}`, JSON.stringify(friends));
    
    // 2. 核心修改：双向同步，把当前账号也加到对方的好友列表里
    let targetFriends = JSON.parse(ChatDB.getItem(`music_friends_${charId}`) || '[]');
    if (!targetFriends.includes(musicLoginId)) {
        targetFriends.push(musicLoginId);
        ChatDB.setItem(`music_friends_${charId}`, JSON.stringify(targetFriends));
    }
    
    alert('添加成功！');
    closeMusicAddFriendModal();
    renderMusicFriends();
}

let listenTogetherTimer = null;
let listenTogetherStartTime = 0; 
window.currentListenTogetherCharId = null; // 全局记录当前一起听歌的对象

function inviteListenTogether(charId, charName) {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    const chatLoginId = ChatDB.getItem('current_login_account');

    if (musicLoginId !== chatLoginId) {
        alert('【账号不匹配】\n您当前在 Music 登录的账号，与 Chat APP 中登录的账号不一致。\n请切换到对应的账号后，再邀请该角色一起听歌！');
        return;
    }

    if (confirm(`确定要邀请 ${charName} 一起听歌吗？`)) {
        // 1. 向聊天室发送邀请卡片
        let history = JSON.parse(ChatDB.getItem(`chat_history_${chatLoginId}_${charId}`) || '[]');
        const now = Date.now();
        history.push({
            role: 'user',
            type: 'music_invite',
            status: 'pending',
            content: '[一起听歌邀请]',
            timestamp: now,
            updateTime: now,
            inviteId: `invite_${now}_${Math.random().toString(36).substr(2, 6)}`,
            songTitle: currentPlayingSong ? currentPlayingSong.title : '',
            songArtist: currentPlayingSong ? currentPlayingSong.artist : '',
            songCover: currentPlayingSong ? currentPlayingSong.cover : ''
        });
        ChatDB.setItem(`chat_history_${chatLoginId}_${charId}`, JSON.stringify(history));
        
        // 2. 更新会话列表顺序
        let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${chatLoginId}`) || '[]');
        sessions = sessions.filter(id => id !== charId);
        sessions.unshift(charId);
        ChatDB.setItem(`chat_sessions_${chatLoginId}`, JSON.stringify(sessions));

        alert('邀请已发送，等待对方回复...');
        // 已移除自动触发 AI 回复的逻辑
    }
}

// 核心：正式开始一起听歌的 UI 逻辑
window.startListenTogether = function(charId) {
    // 触发一起听歌互动统计
    if (typeof updateMusicInteractionStats === 'function') {
        updateMusicInteractionStats(charId);
    }

    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const me = accounts.find(a => a.id === musicLoginId);
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === charId);
    
    if (!char) return;
    
    window.currentListenTogetherCharId = charId;
    const charName = char.netName || char.name;

    const statusEl = document.getElementById('mpListenTogetherStatus');
    if (statusEl) {
        statusEl.style.display = 'flex';
        const textEl = document.getElementById('mpListenTogetherText');
        if (textEl) textEl.innerText = `正在与 ${charName} 一起听歌`;
        
        if (me && me.avatarUrl) {
            document.getElementById('mpListenTogetherAvatar1').style.backgroundImage = `url(${me.avatarUrl})`;
            document.getElementById('mpBigAvatar1').style.backgroundImage = `url(${me.avatarUrl})`;
            const miniAv1 = document.getElementById('miniAvatar1');
            if (miniAv1) miniAv1.style.backgroundImage = `url(${me.avatarUrl})`;
        }
        if (char && char.avatarUrl) {
            document.getElementById('mpListenTogetherAvatar2').style.backgroundImage = `url(${char.avatarUrl})`;
            document.getElementById('mpBigAvatar2').style.backgroundImage = `url(${char.avatarUrl})`;
            const miniAv2 = document.getElementById('miniAvatar2');
            if (miniAv2) miniAv2.style.backgroundImage = `url(${char.avatarUrl})`;
        }
        
        // 切换底部小播放器
        const miniDisc = document.getElementById('miniPlayerDisc');
        const miniAvatars = document.getElementById('miniPlayerTogetherAvatars');
        if (miniDisc && miniAvatars) {
            miniDisc.style.display = 'none';
            miniAvatars.style.display = 'flex';
        }

        // 切换全屏播放器中间的黑胶唱片为双头像 (已取消，保留唱片)
        const normalDisc = document.getElementById('mpNormalDisc');
        const togetherAvatars = document.getElementById('mpTogetherAvatars');
        if (normalDisc && togetherAvatars) {
            // normalDisc.style.display = 'none';
            // togetherAvatars.style.display = 'flex';
        }
        
        // 如果没有传入 startTime，说明是新开始的
        if (!window.restoredListenStartTime) {
            listenTogetherStartTime = Date.now();
        } else {
            listenTogetherStartTime = window.restoredListenStartTime;
            window.restoredListenStartTime = null;
        }
        
        // 持久化状态
        ChatDB.setItem('music_listen_together_charId', charId);
        ChatDB.setItem('music_listen_together_startTime', listenTogetherStartTime.toString());

        document.getElementById('mpListenTime').innerText = Math.floor((Date.now() - listenTogetherStartTime) / 60000);
        clearInterval(listenTogetherTimer);
        
        listenTogetherTimer = setInterval(() => {
            const passedMinutes = Math.floor((Date.now() - listenTogetherStartTime) / 60000);
            document.getElementById('mpListenTime').innerText = passedMinutes;
            updateCapsuleUI(); // 实时更新胶囊上的时长
        }, 1000);
    }
    
    if (typeof showToast === 'function') {
        showToast(`已和 ${charName} 开始一起听歌`, 'success', 2000);
    }
};

// 处理 Char 主动邀请的弹窗响应
window.handleMusicInviteResponse = function(isAccept) {
    document.getElementById('musicInviteModalOverlay').classList.remove('show');
    const currentLoginId = ChatDB.getItem('current_login_account');
    const charId = window.currentListenTogetherCharId; 
    if (!currentLoginId || !charId) return;

    if (isAccept) {
        window.startListenTogether(charId);
        
        // 播放选中的歌曲
        if (window.pendingInviteSong) {
            const song = window.pendingInviteSong;
            if (song.isGenerated) {
                playGeneratedSong(song.title, song.artist);
            } else if (song.url && song.url.startsWith('data:audio')) {
                playLocalSong(song);
            } else {
                musicPlaySong(song.id, song.title, song.artist, song.cover);
            }
            window.pendingInviteSong = null; // 清空
        }
    }
    
    if (typeof renderChatHistory === 'function' && typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId === charId) {
        renderChatHistory(charId);
    }
};

// ==========================================
// 全屏播放器交互逻辑 (已移除旧菜单)
// ==========================================

function endListenTogether(e) {
    if(e) e.stopPropagation();
    if(confirm('确定要结束一起听歌吗？')) {
        // 更新最后一条邀请消息的更新时间和状态
        const currentLoginId = ChatDB.getItem('current_login_account');
        if (currentLoginId && window.currentListenTogetherCharId) {
            let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${window.currentListenTogetherCharId}`) || '[]');
            // 从后往前找最后一条已同意的邀请
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].type === 'music_invite' && history[i].status === 'accepted') {
                    history[i].status = 'ended';
                    history[i].updateTime = Date.now();
                    break;
                }
            }
            ChatDB.setItem(`chat_history_${currentLoginId}_${window.currentListenTogetherCharId}`, JSON.stringify(history));
            if (typeof renderChatHistory === 'function' && currentChatRoomCharId === window.currentListenTogetherCharId) {
                renderChatHistory(window.currentListenTogetherCharId);
            }
        }

        // 清除持久化状态
        ChatDB.removeItem('music_listen_together_charId');
        ChatDB.removeItem('music_listen_together_startTime');

        document.getElementById('mpListenTogetherStatus').style.display = 'none';
        clearInterval(listenTogetherTimer);
        listenTogetherTimer = null; 
        window.currentListenTogetherCharId = null;
        
        // 恢复底部小播放器显示为黑胶唱片
        const miniDisc = document.getElementById('miniPlayerDisc');
        const miniAvatars = document.getElementById('miniPlayerTogetherAvatars');
        if (miniDisc && miniAvatars) {
            miniDisc.style.display = 'flex';
            miniAvatars.style.display = 'none';
        }

        // 恢复全屏播放器中间的黑胶唱片 (已取消，保留唱片)
        const normalDisc = document.getElementById('mpNormalDisc');
        const togetherAvatars = document.getElementById('mpTogetherAvatars');
        if (normalDisc && togetherAvatars) {
            // normalDisc.style.display = 'flex';
            // togetherAvatars.style.display = 'none';
        }
        
        updateCapsuleUI(); // 刷新悬浮胶囊恢复单封面
        alert('已结束一起听歌');
    }
}

function triggerMpBgUpload(e) {
    if(e) e.stopPropagation();
    // 直接触发上传
    document.getElementById('mpBgUploadInput').click();
}

// 切换黑胶唱片与歌词显示
function toggleMpLyric() {
    const discArea = document.getElementById('mpDiscArea');
    const lyricArea = document.getElementById('mpLyricArea');
    if (discArea && lyricArea) {
        if (discArea.style.display === 'none') {
            discArea.style.display = 'flex';
            lyricArea.style.display = 'none';
        } else {
            discArea.style.display = 'none';
            lyricArea.style.display = 'flex';
        }
    }
}

// 播放模式切换逻辑
let currentPlayMode = 'loop'; // 'loop' 列表循环, 'single' 单曲循环, 'random' 随机播放

function togglePlayMode() {
    const btn = document.getElementById('mpPlayModeBtn');
    const miniBtn = document.getElementById('miniPlayModeBtn');
    
    if (currentPlayMode === 'loop') {
        currentPlayMode = 'single';
        const icon = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><text x="12" y="16" font-size="8" fill="currentColor" stroke="none" text-anchor="middle">1</text></svg>`;
        if(btn) btn.innerHTML = icon;
        if(miniBtn) miniBtn.innerHTML = icon;
        alert('已切换为：单曲循环');
    } else if (currentPlayMode === 'single') {
        currentPlayMode = 'random';
        const icon = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`;
        if(btn) btn.innerHTML = icon;
        if(miniBtn) miniBtn.innerHTML = icon;
        alert('已切换为：随机播放');
    } else {
        currentPlayMode = 'loop';
        const icon = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
        if(btn) btn.innerHTML = icon;
        if(miniBtn) miniBtn.innerHTML = icon;
        alert('已切换为：列表循环');
    }
}

// 播放列表弹窗逻辑
function openMpPlaylist() {
    const modal = document.getElementById('mpPlaylistModal');
    if (modal) {
        modal.style.transform = 'translateY(0)';
    }
}

function closeMpPlaylist() {
    const modal = document.getElementById('mpPlaylistModal');
    if (modal) {
        modal.style.transform = 'translateY(100%)';
    }
}

function handleMpBgUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = e.target.result;
            const playerPanel = document.getElementById('musicPlayerPanel');
            if (playerPanel) {
                playerPanel.style.backgroundImage = `url('${imgUrl}')`;
                // 【修复】：保存到本地存储，防止刷新丢失
                const musicLoginId = ChatDB.getItem('music_current_login_account');
                if (musicLoginId) {
                    try {
                        ChatDB.setItem(`music_player_bg_${musicLoginId}`, imgUrl);
                    } catch (err) {
                        console.warn("图片过大，无法持久化保存", err);
                    }
                }
            }
        }
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

// 音乐进度条与播放控制逻辑
audioPlayer.addEventListener('timeupdate', () => {
    const currentTime = audioPlayer.currentTime;
    const duration = audioPlayer.duration;

    // 1. 滚动歌词逻辑
    if (window.parsedLyrics && window.parsedLyrics.length > 0) {
        let activeIdx = 0;
        for (let i = 0; i < window.parsedLyrics.length; i++) {
            if (currentTime >= window.parsedLyrics[i].time) {
                activeIdx = i;
            } else {
                break;
            }
        }
        const lyricLines = document.querySelectorAll('.lyric-line');
        const lyricContent = document.getElementById('mpLyricContent');
        const miniLyric = document.getElementById('miniPlayerLyric');
        if (lyricLines[activeIdx] && !lyricLines[activeIdx].classList.contains('active')) {
            lyricLines.forEach(l => l.classList.remove('active'));
            lyricLines[activeIdx].classList.add('active');
            if (miniLyric) miniLyric.innerText = window.parsedLyrics[activeIdx].text;
            if (lyricContent) {
                const lineEl = lyricLines[activeIdx];
                const containerHeight = lyricContent.offsetHeight;
                const lineOffset = lineEl.offsetTop;
                const lineHeight = lineEl.offsetHeight;
                lyricContent.scrollTo({
                    top: lineOffset - containerHeight / 2 + lineHeight / 2,
                    behavior: 'smooth'
                });
            }
        }
    }

    // 2. 进度条逻辑
    if (!isNaN(duration)) {
        const progressPercent = (currentTime / duration) * 100;
        const fill = document.getElementById('mpProgressFill');
        const dot = document.getElementById('mpProgressDot');
        if(fill) fill.style.width = `${progressPercent}%`;
        if(dot) dot.style.left = `${progressPercent}%`;
        const curTimeEl = document.getElementById('mpCurrentTime');
        const durTimeEl = document.getElementById('mpDuration');
        if(curTimeEl) curTimeEl.innerText = formatTime(currentTime);
        if(durTimeEl) durTimeEl.innerText = formatTime(duration);

        // 同步迷你播放器进度
        const miniFill = document.getElementById('miniProgressFill');
        const miniCur = document.getElementById('miniCurrentTime');
        const miniDur = document.getElementById('miniDuration');
        if(miniFill) miniFill.style.width = `${progressPercent}%`;
        if(miniCur) miniCur.innerText = formatTime(currentTime);
        if(miniDur) miniDur.innerText = formatTime(duration);
    }
});

audioPlayer.addEventListener('play', () => {
    // 全屏播放器按钮
    const mpPlayBtn = document.getElementById('mpPlayBtn');
    const mpPauseBtn = document.getElementById('mpPauseBtn');
    if (mpPlayBtn) mpPlayBtn.style.display = 'none';
    if (mpPauseBtn) mpPauseBtn.style.display = 'block';
    
    // 迷你播放器按钮
    const miniPlayBtn2 = document.getElementById('miniPlayBtn2');
    const miniPauseBtn2 = document.getElementById('miniPauseBtn2');
    if (miniPlayBtn2) miniPlayBtn2.style.display = 'none';
    if (miniPauseBtn2) miniPauseBtn2.style.display = 'block';

    const disc = document.querySelector('.mp-disc-outer');
    if (disc) disc.style.animationPlayState = 'running';
});

audioPlayer.addEventListener('pause', () => {
    // 全屏播放器按钮
    const mpPlayBtn = document.getElementById('mpPlayBtn');
    const mpPauseBtn = document.getElementById('mpPauseBtn');
    if (mpPlayBtn) mpPlayBtn.style.display = 'block';
    if (mpPauseBtn) mpPauseBtn.style.display = 'none';
    
    // 迷你播放器按钮
    const miniPlayBtn2 = document.getElementById('miniPlayBtn2');
    const miniPauseBtn2 = document.getElementById('miniPauseBtn2');
    if (miniPlayBtn2) miniPlayBtn2.style.display = 'block';
    if (miniPauseBtn2) miniPauseBtn2.style.display = 'none';

    const disc = document.querySelector('.mp-disc-outer');
    if (disc) disc.style.animationPlayState = 'paused';
});

function toggleMusicPlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
    // 新增：写入系统消息
    if (window.currentListenTogetherCharId) {
        const state = audioPlayer.paused ? '暂停了播放' : '继续了播放';
        addMusicSystemMessage(`我 ${state}`);
    }
}

function seekMusic(event) {
    const progressBar = document.getElementById('mpProgressBar');
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    if (!isNaN(audioPlayer.duration)) {
        audioPlayer.currentTime = percentage * audioPlayer.duration;
    }
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ==========================================
// 6. 全屏播放器逻辑
// ==========================================
function openMusicPlayer() {
    const player = document.getElementById('musicPlayerPanel');
    if (player) {
        player.style.display = 'flex';
        // 【修复】：打开时读取保存的背景
        const musicLoginId = ChatDB.getItem('music_current_login_account');
        if (musicLoginId) {
            const savedBg = ChatDB.getItem(`music_player_bg_${musicLoginId}`);
            if (savedBg) {
                player.style.backgroundImage = `url('${savedBg}')`;
            }
        }
    }
}

// 修改后 (music.js 末尾)
function closeMusicPlayer() {
    const player = document.getElementById('musicPlayerPanel');
    if (player) player.style.display = 'none';
    const statusEl = document.getElementById('mpListenTogetherStatus');
    if (statusEl) statusEl.style.display = 'none';
}

// 【新增】：获取网易云推荐歌单
async function fetchMusicRecommendPlaylists() {
    const grid = document.querySelector('.music-playlist-grid');
    if (!grid) return;
    
    try {
        const baseUrl = getMusicSearchApiUrl();
        const res = await fetch(`${baseUrl}/top/playlist?limit=6&order=hot`);
        const data = await res.json();
        
        if (data.code === 200 && data.playlists) {
            grid.innerHTML = '';
            data.playlists.forEach(pl => {
                const card = document.createElement('div');
                card.className = 'music-playlist-card';
                // 点击歌单可以直接调用 URL 导入逻辑将其保存到自己的歌单中
                card.onclick = () => {
                    if(confirm(`要将《${pl.name}》保存到我的歌单吗？`)) {
                        document.getElementById('music-import-url-input').value = pl.id;
                        musicImportByUrl();
                    }
                };
                card.innerHTML = `
                    <div class="music-playlist-cover" style="background-image: url('${pl.coverImgUrl}?param=200y200'); background-size: cover;"></div>
                    <div class="music-playlist-name">${pl.name}</div>
                `;
                grid.appendChild(card);
            });
        }
    } catch (e) {
        console.error("获取推荐歌单失败", e);
    }
}
// ==========================================
// 【新增】：添加到歌单、编辑歌单、歌单详情逻辑
// ==========================================

let tempAddSong = null;

function openAddToPlaylistModal(id, title, artist, cover) {
    tempAddSong = { id, title, artist, cover };
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    if (!musicLoginId) return alert("请先登录音乐账号");
    
    const select = document.getElementById('addToPlaylistSelect');
    select.innerHTML = '<option value="">请选择歌单</option>';
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    savedPlaylists.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.innerText = pl.name;
        select.appendChild(opt);
    });
    document.getElementById('musicAddToPlaylistModal').classList.add('show');
}

function confirmAddToPlaylist() {
    const playlistId = document.getElementById('addToPlaylistSelect').value;
    if (!playlistId) return alert("请选择歌单！");
    
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    const plIndex = savedPlaylists.findIndex(p => p.id === playlistId);
    
    if (plIndex !== -1 && tempAddSong) {
        if (!savedPlaylists[plIndex].tracks) savedPlaylists[plIndex].tracks = [];
        // 查重
        if (savedPlaylists[plIndex].tracks.some(t => t.id == tempAddSong.id)) {
            alert("该歌曲已在歌单中！");
            return;
        }
        savedPlaylists[plIndex].tracks.push(tempAddSong);
        savedPlaylists[plIndex].trackCount = savedPlaylists[plIndex].tracks.length;
        ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
        alert("添加成功！");
        document.getElementById('musicAddToPlaylistModal').classList.remove('show');
        renderMyPlaylists();
    }
}

let tempEditPlaylistCoverBase64 = null;

function openEditPlaylistModal(id) {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    const pl = savedPlaylists.find(p => String(p.id) === String(id));
    if (!pl) return;
    
    document.getElementById('editPlaylistId').value = pl.id;
    document.getElementById('editPlaylistName').value = pl.name;
    document.getElementById('editPlaylistCover').value = pl.cover;
    tempEditPlaylistCoverBase64 = null;
    document.getElementById('musicEditPlaylistModal').classList.add('show');
}

function handleEditPlaylistCover(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempEditPlaylistCoverBase64 = e.target.result;
            document.getElementById('editPlaylistCover').value = '已选择本地图片';
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function confirmEditPlaylist() {
    const id = document.getElementById('editPlaylistId').value;
    const name = document.getElementById('editPlaylistName').value.trim();
    const coverUrl = document.getElementById('editPlaylistCover').value.trim();
    if (!name) return alert("请输入歌单名称！");

    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    const plIndex = savedPlaylists.findIndex(p => String(p.id) === String(id));
    if (plIndex !== -1) {
        savedPlaylists[plIndex].name = name;
        if (tempEditPlaylistCoverBase64) {
            savedPlaylists[plIndex].cover = tempEditPlaylistCoverBase64;
        } else if (coverUrl && coverUrl !== '已选择本地图片') {
            savedPlaylists[plIndex].cover = coverUrl;
        }
        ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
        document.getElementById('musicEditPlaylistModal').classList.remove('show');
        renderMyPlaylists();
    }
}

function deletePlaylist() {
    if (!confirm("确定要删除该歌单吗？")) return;
    const id = document.getElementById('editPlaylistId').value;
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    savedPlaylists = savedPlaylists.filter(p => String(p.id) !== String(id));
    ChatDB.setItem(`music_playlists_${musicLoginId}`, JSON.stringify(savedPlaylists));
    document.getElementById('musicEditPlaylistModal').classList.remove('show');
    renderMyPlaylists();
}

function openPlaylistDetail(id, isCharPlaylist = false, charId = null) {
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let savedPlaylists = [];
    
    if (isCharPlaylist && charId) {
        savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${charId}`) || '[]');
    } else {
        savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${musicLoginId}`) || '[]');
    }
    
    const pl = savedPlaylists.find(p => p.id === id);
    if (!pl) return;

    // 网易云风格 UI 赋值
    document.getElementById('playlistDetailName').innerText = pl.name;
    document.getElementById('playlistDetailCount').innerText = `(${pl.tracks ? pl.tracks.length : 0})`;
    document.getElementById('playlistDetailCover').style.backgroundImage = `url('${pl.cover}')`;
    
    const bgEl = document.getElementById('playlistDetailBg');
    if (bgEl) bgEl.style.backgroundImage = `url('${pl.cover}')`;
    
    // 模拟创建者信息
    let creatorName = "我";
    let creatorAvatar = "https://p2.music.126.net/6y-7YvS_G8V8.jpg";
    if (isCharPlaylist && charId) {
        let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
        const char = chars.find(c => c.id === charId);
        if (char) {
            creatorName = char.netName || char.name;
            creatorAvatar = char.avatarUrl || creatorAvatar;
        }
    } else {
        let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
        const acc = accounts.find(a => a.id === musicLoginId);
        if (acc) {
            creatorName = acc.netName || "我";
            creatorAvatar = acc.avatarUrl || creatorAvatar;
        }
    }
    
    const creatorAvatarEl = document.getElementById('playlistDetailCreatorAvatar');
    if (creatorAvatarEl) creatorAvatarEl.style.backgroundImage = `url('${creatorAvatar}')`;
    const creatorNameEl = document.getElementById('playlistDetailCreatorName');
    if (creatorNameEl) creatorNameEl.innerText = creatorName + " >";
    const descEl = document.getElementById('playlistDetailDesc');
    if (descEl) descEl.innerText = "编辑信息 >";

    const tracksContainer = document.getElementById('playlistDetailTracks');
    tracksContainer.innerHTML = '';
    
    if (pl.tracks && pl.tracks.length > 0) {
        pl.tracks.forEach((song, index) => {
            const item = document.createElement('div');
            // 网易云列表风格
            item.style.cssText = 'display: flex; align-items: center; padding: 12px 20px; gap: 15px; cursor: pointer;';
            item.onclick = () => {
                window.currentPlaylistTracks = pl.tracks;
                renderMpPlaylist();
                if (song.url && song.url.startsWith('data:audio')) {
                    playLocalSong(song);
                } else if (song.isGenerated) {
                    playGeneratedSong(song.title, song.artist);
                } else {
                    musicPlaySong(song.id, song.title, song.artist, song.cover);
                }
            };
            let innerVoiceHtml = '';
            if (song.innerVoice) {
                innerVoiceHtml = `<div style="font-size: 11px; color: #ff5000; margin-top: 4px; font-style: italic; background: rgba(255,80,0,0.05); padding: 4px 8px; border-radius: 6px; display: inline-block;">"${song.innerVoice}"</div>`;
            }

            item.innerHTML = `
                <div style="width: 20px; text-align: center; color: #999; font-size: 15px; font-weight: bold;">${index + 1}</div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
                    <div style="font-size: 15px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                    <div style="font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</div>
                    ${innerVoiceHtml}
                </div>
                <div onclick="event.stopPropagation(); removeSongFromPlaylist('${pl.id}', '${song.id}', ${isCharPlaylist}, '${charId}')" style="padding: 5px; color: #ccc; display: ${id === 'recent' ? 'none' : 'block'};">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
            `;

            tracksContainer.appendChild(item);
        });
    } else {
        if (id === 'recent') {
            tracksContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#888; font-size:13px;">暂无最近播放记录，点击右上角按钮生成</div>';
        } else {
            tracksContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#888; font-size:13px;">歌单为空，快去添加歌曲吧</div>';
        }
    }

    // 处理加载更多按钮
    const loadMoreBtn = document.getElementById('playlistLoadMoreBtn');
    if (isCharPlaylist && pl.tracks && pl.tracks.length < (pl.trackCount || 50) && id !== 'recent') {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.onclick = () => loadMoreCharSongsAPI(charId, pl.id);
    } else {
        loadMoreBtn.style.display = 'none';
    }

    // 绑定播放全部按钮
    window.playAllPlaylistSongs = function() {
        if (pl.tracks && pl.tracks.length > 0) {
            window.currentPlaylistTracks = pl.tracks;
            renderMpPlaylist();
            const firstSong = pl.tracks[0];
            if (firstSong.url && firstSong.url.startsWith('data:audio')) {
                playLocalSong(firstSong);
            } else if (firstSong.isGenerated) {
                playGeneratedSong(firstSong.title, firstSong.artist);
            } else {
                musicPlaySong(firstSong.id, firstSong.title, firstSong.artist, firstSong.cover);
            }
        }
    };

    const regenBtn = document.getElementById('playlistRegenerateBtn');
    if (id === 'recent') {
        regenBtn.style.display = 'flex';
        regenBtn.onclick = () => generateCharRecentMusicAPI(charId || musicLoginId);
    } else {
        regenBtn.style.display = 'none';
    }

    document.getElementById('musicPlaylistDetailPanel').style.display = 'flex';
}

// 【新增】：从歌单中删除歌曲
window.removeSongFromPlaylist = function(playlistId, songId, isCharPlaylist, charId) {
    if (!confirm("确定要将这首歌从歌单中移除吗？")) return;
    
    const musicLoginId = ChatDB.getItem('music_current_login_account');
    let dbKey = isCharPlaylist ? `music_playlists_${charId}` : `music_playlists_${musicLoginId}`;
    let savedPlaylists = JSON.parse(ChatDB.getItem(dbKey) || '[]');
    
    const plIndex = savedPlaylists.findIndex(p => p.id === playlistId);
    if (plIndex !== -1) {
        savedPlaylists[plIndex].tracks = savedPlaylists[plIndex].tracks.filter(s => String(s.id) !== String(songId));
        savedPlaylists[plIndex].trackCount = savedPlaylists[plIndex].tracks.length;
        ChatDB.setItem(dbKey, JSON.stringify(savedPlaylists));
        
        // 刷新当前页面
        openPlaylistDetail(playlistId, isCharPlaylist, charId);
        // 刷新主页歌单列表
        if (!isCharPlaylist) renderMyPlaylists();
    }
};

// 播放 AI 生成的歌曲 (先搜索再播放)
async function playGeneratedSong(title, artist) {
    if (typeof showToast === 'function') showToast('正在搜索音源...', 'loading');
    try {
        const baseUrl = getMusicSearchApiUrl();
        const kw = `${title} ${artist}`;
        const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(kw)}&limit=1`);
        const data = await res.json();
        
        if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
            const song = data.result.songs[0];
            const cover = (song.al && song.al.picUrl) ? song.al.picUrl + '?param=100y100' : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100';
            if (typeof hideToast === 'function') hideToast();
            musicPlaySong(song.id, song.name, artist, cover);
        } else {
            if (typeof hideToast === 'function') hideToast();
            alert(`未找到《${title}》的音源，请尝试其他歌曲。`);
        }
    } catch (e) {
        if (typeof hideToast === 'function') hideToast();
        alert("搜索音源失败，请检查网络或切换搜索接口。");
    }
}

function closePlaylistDetail() {
    document.getElementById('musicPlaylistDetailPanel').style.display = 'none';
}

function playLocalSong(song) {
    // 更新底部悬浮播放器 UI
    document.querySelector('.music-player-title').innerText = song.title;
    document.querySelector('.music-player-sub').innerText = song.artist;
    document.querySelector('.music-player-disc-inner').style.backgroundImage = `url(${song.cover})`;
    document.querySelector('.music-player-disc-inner').style.backgroundSize = 'cover';
    
    // 更新全屏播放器 UI
    const mpSongName = document.getElementById('mpSongName');
    if (mpSongName) mpSongName.innerText = song.title;
    const mpArtistName = document.getElementById('mpArtistName');
    if (mpArtistName) mpArtistName.innerText = song.artist;
    const mpDiscCover = document.getElementById('mpDiscCover');
    if (mpDiscCover) mpDiscCover.style.backgroundImage = `url(${song.cover})`;
    
    const mpLyricTitle = document.getElementById('mpLyricTitle');
    if (mpLyricTitle) mpLyricTitle.innerText = song.title;
    const mpLyricArtist = document.getElementById('mpLyricArtist');
    if (mpLyricArtist) mpLyricArtist.innerText = song.artist;
    
    currentPlayingSong = song;

    audioPlayer.src = song.url;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            const disc = document.querySelector('.mp-disc-outer');
            if (disc) disc.style.animationPlayState = 'running';
            
            const playerPanel = document.getElementById('musicPlayerPanel');
            if (playerPanel) {
                const musicLoginId = ChatDB.getItem('music_current_login_account');
                const savedBg = musicLoginId ? ChatDB.getItem(`music_player_bg_${musicLoginId}`) : null;
                if (!savedBg) {
                    playerPanel.style.backgroundImage = `url('${song.cover}')`;
                }
            }
            
            // 👇 核心注入：本地歌曲播放时同样接管系统锁屏
            updateSystemMediaSession();
            // 【修复】：同步更新悬浮胶囊和迷你播放器的 UI
            if (typeof updateCapsuleUI === 'function') updateCapsuleUI();
            
        }).catch(e => console.error(e));
    }
}
// ==========================================
// 【新增】：音乐分享逻辑 (聊天 & 朋友圈)
// ==========================================

function openMusicShareModal() {
    if (!currentPlayingSong) return alert("当前没有正在播放的歌曲！");
    document.getElementById('musicShareModalOverlay').classList.add('show');
}

function closeMusicShareModal() {
    document.getElementById('musicShareModalOverlay').classList.remove('show');
}

function closeMusicShareChatModal() {
    document.getElementById('musicShareChatModalOverlay').classList.remove('show');
}

// 1. 分享到聊天
function shareMusicToChat() {
    closeMusicShareModal();
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert("请先在 Chat 中登录账号！");

    let contacts = JSON.parse(ChatDB.getItem(`contacts_${currentLoginId}`) || '[]');
    let allChars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    let remarks = JSON.parse(ChatDB.getItem(`char_remarks_${currentLoginId}`) || '{}');
    
    const listEl = document.getElementById('musicShareContactList');
    listEl.innerHTML = '';
    
    const friends = contacts.map(id => allChars.find(c => c.id === id)).filter(c => c);
    
    if (friends.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#aaa; font-size:12px;">暂无好友可分享</div>';
    } else {
        friends.forEach(f => {
            const displayName = remarks[f.id] || f.netName || f.name;
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: #f9f9f9; border-radius: 10px; cursor: pointer;';
            item.innerHTML = `
                <div style="width: 36px; height: 36px; border-radius: 8px; background-image: url('${f.avatarUrl || ''}'); background-size: cover; background-color: #eee;"></div>
                <div style="font-size: 14px; font-weight: bold; color: #333;">${displayName}</div>
            `;
            item.onclick = () => confirmShareMusicToChat(f.id);
            listEl.appendChild(item);
        });
    }
    
    document.getElementById('musicShareChatModalOverlay').classList.add('show');
}

function confirmShareMusicToChat(targetCharId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${targetCharId}`) || '[]');
    
    // 构建仿网易云音乐卡片 HTML
    const shareHtml = `
        <div class="music-share-card" onclick="openMusicApp(); setTimeout(() => musicPlaySong('${currentPlayingSong.id}', '${currentPlayingSong.title.replace(/'/g, "\\'")}', '${currentPlayingSong.artist.replace(/'/g, "\\'")}', '${currentPlayingSong.cover}'), 500);">
            <img src="${currentPlayingSong.cover}">
            <div class="info">
                <div class="title">${currentPlayingSong.title}</div>
                <div class="artist">${currentPlayingSong.artist}</div>
            </div>
            <div class="icon">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
            </div>
        </div>
    `;

    history.push({
        role: 'user',
        type: 'text',
        content: shareHtml,
        timestamp: Date.now()
    });
    
    ChatDB.setItem(`chat_history_${currentLoginId}_${targetCharId}`, JSON.stringify(history));
    
    // 更新会话列表顺序
    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    sessions = sessions.filter(id => id !== targetCharId);
    sessions.unshift(targetCharId);
    ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));
    
    alert('分享成功！');
    closeMusicShareChatModal();
    
    // 如果当前正好在聊天界面，刷新一下
    if (typeof renderChatList === 'function') renderChatList();
    if (typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId === targetCharId) {
        renderChatHistory(targetCharId);
    }
}

// 2. 分享到朋友圈
function shareMusicToMoment() {
    closeMusicShareModal();
    const currentLoginId = ChatDB.getItem('current_login_account');
    if (!currentLoginId) return alert("请先在 Chat 中登录账号！");

    // 构建仿网易云音乐卡片 HTML
    const shareHtml = `
        <div class="music-share-card" style="width: 100%; margin-top: 10px; background: #f9f9f9;" onclick="openMusicApp(); setTimeout(() => musicPlaySong('${currentPlayingSong.id}', '${currentPlayingSong.title.replace(/'/g, "\\'")}', '${currentPlayingSong.artist.replace(/'/g, "\\'")}', '${currentPlayingSong.cover}'), 500);">
            <img src="${currentPlayingSong.cover}">
            <div class="info">
                <div class="title">${currentPlayingSong.title}</div>
                <div class="artist">${currentPlayingSong.artist}</div>
            </div>
            <div class="icon">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
            </div>
        </div>
    `;

    const newMoment = {
        id: Date.now().toString(),
        authorId: currentLoginId,
        content: `分享单曲：\n${shareHtml}`,
        images: [],
        visibility: 'all',
        timestamp: Date.now(),
        likes: [],
        comments: []
    };

    let moments = JSON.parse(ChatDB.getItem(`moments_${currentLoginId}`) || '[]');
    moments.push(newMoment);
    ChatDB.setItem(`moments_${currentLoginId}`, JSON.stringify(moments));

    alert('已成功分享到朋友圈！');
    
    // 如果当前在朋友圈页面，刷新一下
    if (typeof renderMoments === 'function') renderMoments();
}
// ==========================================
// 【新增】：角色音乐主页与 API 生成歌单逻辑
// ==========================================
let currentMusicProfileCharId = null;

function openMusicCharProfile(charId) {
    currentMusicProfileCharId = charId;
    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === charId);
    if (!char) return;

    // 读取保存的专属背景，如果没有则使用头像
    const savedBg = ChatDB.getItem(`music_char_bg_${charId}`);
    if (savedBg) {
        document.getElementById('mcpBg').style.backgroundImage = `url('${savedBg}')`;
    } else {
        document.getElementById('mcpBg').style.backgroundImage = `url('${char.avatarUrl || ''}')`;
    }
    
    document.getElementById('mcpAvatar').style.backgroundImage = `url('${char.avatarUrl || ''}')`;
    document.getElementById('mcpName').innerText = char.netName || char.name;
    document.getElementById('mcpSign').innerText = char.signature || '这个人很神秘，什么都没写~';

    renderCharPlaylists(charId);
    document.getElementById('musicCharProfilePanel').style.display = 'flex';
}

function closeMusicCharProfile() {
    document.getElementById('musicCharProfilePanel').style.display = 'none';
}

// 处理角色音乐主页背景上传
function handleMusicCharBgUpload(event) {
    const file = event.target.files[0];
    if (file && currentMusicProfileCharId) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgUrl = e.target.result;
            const bgEl = document.getElementById('mcpBg');
            if (bgEl) {
                bgEl.style.backgroundImage = `url('${imgUrl}')`;
            }
            try {
                ChatDB.setItem(`music_char_bg_${currentMusicProfileCharId}`, imgUrl);
            } catch (err) {
                console.warn("图片过大，无法持久化保存", err);
                alert("图片体积过大，本次已应用，但可能无法永久保存。");
            }
        }
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function renderCharPlaylists(charId) {
    const container = document.getElementById('mcpPlaylistContainer');
    container.innerHTML = '';
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${charId}`) || '[]');
    
    if (savedPlaylists.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px 0; color:#aaa; font-size:13px;">TA 还没有专属歌单，点击右上角生成吧</div>';
        return;
    }

    savedPlaylists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'music-pl-item';
        div.onclick = () => openPlaylistDetail(pl.id, true, charId);
        div.innerHTML = `
            <div class="music-pl-cover" style="background-image: url('${pl.cover}');"></div>
            <div class="music-pl-info">
                <div class="music-pl-title">${pl.name}</div>
                <div class="music-pl-sub">专属歌单 · 已生成 ${pl.tracks ? pl.tracks.length : 0}/${pl.trackCount || 50}首</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 调用 API 生成角色歌单
async function generateCharPlaylistAPI() {
    if (!currentMusicProfileCharId) return;
    const charId = currentMusicProfileCharId;
    const currentLoginId = ChatDB.getItem('current_login_account');
    
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) {
        return alert('请先在 Chat 设置中配置 API 信息！');
    }

    let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
    const char = chars.find(c => c.id === charId);
    let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
    const account = accounts.find(a => a.id === currentLoginId);
    let personas = JSON.parse(ChatDB.getItem('chat_personas') || '[]');
    const persona = personas.find(p => p.id === (account ? account.personaId : null));

    // 获取世界书
    let activeWbs = [];
    if (char.wbEntries && char.wbEntries.length > 0) {
        let wbData = JSON.parse(ChatDB.getItem('worldbook_data')) || { entries: [] };
        let entries = wbData.entries.filter(e => char.wbEntries.includes(e.id));
        entries.forEach(entry => { if (entry.constant) activeWbs.push(entry.content); });
    }

    const prompt = `你是一个资深的音乐DJ。请根据以下角色设定，为该角色生成一个符合其性格、背景和喜好的专属歌单。
【角色设定】：${char.description || '无'}
【用户设定】：${persona ? persona.persona : '无'}
【世界书背景】：${activeWbs.join('\n')}

要求：
1. 必须返回合法的 JSON 对象。
2. 包含歌单名称(playlistName)、总歌曲数(trackCount，设定为50-100之间)。
3. 包含初始的 30 首歌曲列表(songs数组)，每首歌包含 title(歌名) 和 artist(歌手)。
4. 歌曲必须是现实中真实存在的知名歌曲，以便能够在音乐软件中搜索到。不要自己瞎编歌名！

JSON 格式示例：
{
  "playlistName": "深渊的低语",
  "trackCount": 60,
  "songs": [
    {"title": "夜曲", "artist": "周杰伦"},
    {"title": "Creep", "artist": "Radiohead"}
  ]
}`;

    if (typeof showToast === 'function') showToast('正在生成专属歌单...', 'loading');

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
            if (!parsed.playlistName || !parsed.songs) throw new Error("JSON 格式不正确");

            const newPlaylist = {
                id: 'char_pl_' + Date.now(),
                name: parsed.playlistName,
                cover: char.avatarUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg',
                trackCount: parsed.trackCount || 50,
                tracks: parsed.songs.map(s => ({
                    id: 'gen_' + Date.now() + Math.random(),
                    title: s.title,
                    artist: s.artist,
                    isGenerated: true,
                    cover: char.avatarUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg'
                }))
            };

            let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${charId}`) || '[]');
            savedPlaylists.push(newPlaylist);
            ChatDB.setItem(`music_playlists_${charId}`, JSON.stringify(savedPlaylists));

            if (typeof hideToast === 'function') hideToast();
            alert('专属歌单生成成功！');
            renderCharPlaylists(charId);
        } else {
            throw new Error("API 请求失败");
        }
    } catch (e) {
        if (typeof hideToast === 'function') hideToast();
        alert('生成失败，请检查 API 配置或重试。\n' + e.message);
    }
}

// 调用 API 加载更多歌曲
async function loadMoreCharSongsAPI(charId, playlistId) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    let savedPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${charId}`) || '[]');
    const plIndex = savedPlaylists.findIndex(p => p.id === playlistId);
    if (plIndex === -1) return;
    
    const pl = savedPlaylists[plIndex];
    const existingSongs = pl.tracks.map(t => `${t.title} - ${t.artist}`).join('\n');

    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) return alert('请配置 API！');

    const prompt = `你之前为角色生成了一个名为《${pl.name}》的专属歌单。
以下是歌单中已经存在的歌曲：
${existingSongs}

请继续为该歌单生成 20 首【不重复】的、符合该歌单风格的真实存在的歌曲。
必须且只能返回 JSON 格式，包含 songs 数组，每首歌包含 title 和 artist。
示例：{"songs": [{"title":"xxx", "artist":"yyy"}]}`;

    const btn = document.getElementById('playlistLoadMoreBtn');
    const originalText = btn.innerText;
    btn.innerText = '正在生成中...';
    btn.style.pointerEvents = 'none';

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
            if (parsed.songs && Array.isArray(parsed.songs)) {
                const newTracks = parsed.songs.map(s => ({
                    id: 'gen_' + Date.now() + Math.random(),
                    title: s.title,
                    artist: s.artist,
                    isGenerated: true,
                    cover: pl.cover
                }));
                
                pl.tracks = pl.tracks.concat(newTracks);
                ChatDB.setItem(`music_playlists_${charId}`, JSON.stringify(savedPlaylists));
                
                // 刷新详情页
                openPlaylistDetail(playlistId, true, charId);
            }
        } else {
            throw new Error("API 请求失败");
        }
    } catch (e) {
        alert('加载失败: ' + e.message);
    } finally {
        btn.innerText = originalText;
        btn.style.pointerEvents = 'auto';
    }
}
// ==========================================
// 【新增】：播放列表渲染与搜索取消逻辑
// ==========================================
window.currentPlaylistTracks = [];

function renderMpPlaylist() {
    // 保存当前播放列表到本地，防止退出后台/刷新后丢失
    localStorage.setItem('music_current_playlist', JSON.stringify(window.currentPlaylistTracks || []));
    
    const contentEl = document.getElementById('mpPlaylistContent');
    if (!contentEl) return;
    
    if (!window.currentPlaylistTracks || window.currentPlaylistTracks.length === 0) {
        contentEl.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 20px;">暂无歌曲</div>';
        return;
    }
    
    contentEl.innerHTML = '';
    window.currentPlaylistTracks.forEach((song, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;';
        
        // 高亮当前正在播放的歌曲
        const isPlaying = currentPlayingSong && (String(currentPlayingSong.id) === String(song.id) || currentPlayingSong.title === song.title);
        const titleColor = isPlaying ? '#ff3b30' : '#fff';
        
        item.onclick = () => {
            if (song.url && song.url.startsWith('data:audio')) {
                playLocalSong(song);
            } else if (song.isGenerated) {
                playGeneratedSong(song.title, song.artist);
            } else {
                musicPlaySong(song.id, song.title, song.artist, song.cover);
            }
            renderMpPlaylist(); // 刷新高亮状态
        };
        
        item.innerHTML = `
            <div style="width: 20px; text-align: center; color: ${isPlaying ? '#ff3b30' : 'rgba(255,255,255,0.4)'}; font-size: 12px; font-weight: bold;">
                ${isPlaying ? '▶' : index + 1}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
                <div style="font-size: 14px; font-weight: bold; color: ${titleColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.artist}</div>
            </div>
        `;
        contentEl.appendChild(item);
    });
}

// 搜索取消逻辑
function cancelMusicSearch() {
    document.getElementById('music-search-input').value = '';
    document.getElementById('music-search-cancel').style.display = 'none';
    musicPerformSearch(); // 传空值会恢复主页 UI
}
// ==========================================
// 【新增】：一起听歌实时交互与 AI 控制逻辑
// ==========================================

// 1. 悬浮输入栏显示与拖拽逻辑
function toggleMusicFloatingInput() {
    const bar = document.getElementById('musicFloatingInputBar');
    if (bar.style.display === 'none' || !bar.style.display) {
        bar.style.display = 'flex';
        document.getElementById('musicFloatingInputText').focus();
    } else {
        bar.style.display = 'none';
    }
}

const floatingBar = document.getElementById('musicFloatingInputBar');
const dragHandle = document.getElementById('musicFloatingDragHandle');
let isDragging = false;
let startY, startBottom;

if (dragHandle && floatingBar) {
    dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        startBottom = parseInt(window.getComputedStyle(floatingBar).bottom, 10);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const deltaY = startY - e.touches[0].clientY;
        let newBottom = startBottom + deltaY;
        // 限制拖拽范围
        if (newBottom < 20) newBottom = 20;
        if (newBottom > window.innerHeight - 100) newBottom = window.innerHeight - 100;
        floatingBar.style.bottom = newBottom + 'px';
    }, { passive: true });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// 2. 发送实时消息与弹幕显示
function sendMusicFloatingMessage() {
    const input = document.getElementById('musicFloatingInputText');
    const text = input.value.trim();
    if (!text) return;

    const currentLoginId = ChatDB.getItem('current_login_account');
    const charId = window.currentListenTogetherCharId;
    if (!currentLoginId || !charId) {
        alert("请先开始一起听歌！");
        return;
    }

    // 显示弹幕
    showMusicLiveMessage('user', text);
    input.value = '';

    // 存入聊天记录
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
    history.push({ role: 'user', type: 'text', content: `[一起听歌中] ${text}`, timestamp: Date.now() });
    ChatDB.setItem(`chat_history_${currentLoginId}_${charId}`, JSON.stringify(history));

    // 触发 AI 回复
    if (typeof generateApiReply === 'function') {
        generateApiReply(false, charId);
    }
}

function triggerMusicFloatingAI() {
    const charId = window.currentListenTogetherCharId;
    if (!charId) return alert("请先开始一起听歌！");
    if (typeof generateApiReply === 'function') {
        generateApiReply(false, charId);
    }
}

function showMusicLiveMessage(role, text) {
    const container = document.getElementById('musicLiveMessages');
    if (!container) return;

    const msgEl = document.createElement('div');
    msgEl.className = `music-live-msg ${role}`;
    msgEl.innerText = text;
    
    container.appendChild(msgEl);

    // 保持最多显示 3 条
    if (container.children.length > 3) {
        container.removeChild(container.firstChild);
    }

    // 5秒后自动消失
    setTimeout(() => {
        msgEl.style.opacity = '0';
        setTimeout(() => {
            if (container.contains(msgEl)) container.removeChild(msgEl);
        }, 500);
    }, 5000);
}

// 3. 上一首 / 下一首 逻辑
function playNextMusicSong(isAuto = false) {
    if (!window.currentPlaylistTracks || window.currentPlaylistTracks.length === 0) return alert("当前播放列表为空");
    if (!currentPlayingSong) return;
    
    let currentIndex = window.currentPlaylistTracks.findIndex(s => String(s.id) === String(currentPlayingSong.id));
    if (currentIndex === -1) currentIndex = 0;
    
    let nextIndex = currentIndex + 1;
    if (nextIndex >= window.currentPlaylistTracks.length) nextIndex = 0; // 列表循环
    
    const nextSong = window.currentPlaylistTracks[nextIndex];
    executePlaySongObj(nextSong);
    
    // 新增：写入系统消息
    if (window.currentListenTogetherCharId) {
        if (isAuto) {
            addMusicSystemMessage(`自动切换到了下一首`);
        } else {
            addMusicSystemMessage(`我 切到了下一首`);
        }
    }
}

function playPrevMusicSong() {
    if (!window.currentPlaylistTracks || window.currentPlaylistTracks.length === 0) return alert("当前播放列表为空");
    if (!currentPlayingSong) return;
    
    let currentIndex = window.currentPlaylistTracks.findIndex(s => String(s.id) === String(currentPlayingSong.id));
    if (currentIndex === -1) currentIndex = 0;
    
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = window.currentPlaylistTracks.length - 1; // 列表循环
    
    const prevSong = window.currentPlaylistTracks[prevIndex];
    executePlaySongObj(prevSong);
    
    // 新增：写入系统消息
    if (window.currentListenTogetherCharId) {
        addMusicSystemMessage(`我 切到了上一首`);
    }
}

function executePlaySongObj(song) {
    if (song.url && song.url.startsWith('data:audio')) {
        playLocalSong(song);
    } else if (song.isGenerated) {
        playGeneratedSong(song.title, song.artist);
    } else {
        musicPlaySong(song.id, song.title, song.artist, song.cover);
    }
    if (typeof renderMpPlaylist === 'function') renderMpPlaylist();
}

// 4. AI 控制音乐播放器执行函数
window.handleAiMusicControl = async function(controlObj) {
    if (!controlObj || !controlObj.action) return;
    const action = controlObj.action;
    const target = controlObj.target;

    console.log("AI 执行音乐控制:", action, target);

    switch (action) {
        case 'play':
            audioPlayer.play();
            break;
        case 'pause':
            audioPlayer.pause();
            break;
        case 'next':
            playNextMusicSong();
            break;
        case 'prev':
            playPrevMusicSong();
            break;
        case 'play_song':
            if (target) {
                showToast(`AI 正在点歌: ${target}`, 'loading');
                await aiSearchAndPlay(target);
                hideToast();
            }
            break;
        case 'add_song':
            if (target) {
                await aiSearchAndAdd(target);
            }
            break;
        case 'remove_song':
            if (target && window.currentPlaylistTracks) {
                window.currentPlaylistTracks = window.currentPlaylistTracks.filter(s => !s.title.includes(target));
                if (typeof renderMpPlaylist === 'function') renderMpPlaylist();
            }
            break;
        case 'exit':
            document.getElementById('mpListenTogetherStatus').style.display = 'none';
            clearInterval(listenTogetherTimer);
            window.currentListenTogetherCharId = null;
            const miniDisc = document.getElementById('miniPlayerDisc');
            const miniAvatars = document.getElementById('miniPlayerTogetherAvatars');
            if (miniDisc && miniAvatars) {
                miniDisc.style.display = 'flex';
                miniAvatars.style.display = 'none';
            }
            break;
    }
    
    // 新增：写入系统消息
    if (window.currentListenTogetherCharId) {
        let actionText = '';
        switch (action) {
            case 'play': actionText = '继续了播放'; break;
            case 'pause': actionText = '暂停了播放'; break;
            case 'next': actionText = '切到了下一首'; break;
            case 'prev': actionText = '切到了上一首'; break;
            case 'play_song': actionText = `点播了歌曲: ${target}`; break;
        }
        if (actionText) addMusicSystemMessage(`对方 ${actionText}`);
    }
};

async function aiSearchAndPlay(keyword) {
    try {
        const baseUrl = getMusicSearchApiUrl();
        const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(keyword)}&limit=1`);
        const data = await res.json();
        if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
            const song = data.result.songs[0];
            const cover = (song.al && song.al.picUrl) ? song.al.picUrl + '?param=100y100' : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100';
            musicPlaySong(song.id, song.name, song.ar[0].name, cover);
        }
    } catch (e) { console.error("AI 点歌失败", e); }
}

async function aiSearchAndAdd(keyword) {
    try {
        const baseUrl = getMusicSearchApiUrl();
        const res = await fetch(`${baseUrl}/cloudsearch?keywords=${encodeURIComponent(keyword)}&limit=1`);
        const data = await res.json();
        if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
            const song = data.result.songs[0];
            const cover = (song.al && song.al.picUrl) ? song.al.picUrl + '?param=100y100' : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg?param=100y100';
            if (!window.currentPlaylistTracks) window.currentPlaylistTracks = [];
            window.currentPlaylistTracks.push({
                id: song.id, title: song.name, artist: song.ar[0].name, cover: cover
            });
            if (typeof renderMpPlaylist === 'function') renderMpPlaylist();
        }
    } catch (e) { console.error("AI 添加歌曲失败", e); }
}
// ==========================================
// 【新增】：系统提示、全屏聊天页、悬浮胶囊逻辑
// ==========================================

// 1. 写入系统提示消息
function addMusicSystemMessage(content) {
    const currentLoginId = ChatDB.getItem('current_login_account');
    const charId = window.currentListenTogetherCharId;
    if (!currentLoginId || !charId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
    history.push({ role: 'system', type: 'system', content: content, timestamp: Date.now() });
    ChatDB.setItem(`chat_history_${currentLoginId}_${charId}`, JSON.stringify(history));

    // 如果聊天面板开着，刷新它
    if (document.getElementById('musicChatPanel').style.display === 'flex') {
        renderMusicChatHistory();
    }
    if (document.getElementById('chatRoomPanel').style.display === 'flex' && currentChatRoomCharId === charId) {
        renderChatHistory(charId);
    }
}

// 2. 音乐全屏聊天面板
function openMusicChatPanel() {
    if (!window.currentListenTogetherCharId) return alert("请先开始一起听歌！");
    document.getElementById('musicChatPanel').style.display = 'flex';
    renderMusicChatHistory();
}

function closeMusicChatPanel() {
    document.getElementById('musicChatPanel').style.display = 'none';
}

function renderMusicChatHistory() {
    const charId = window.currentListenTogetherCharId;
    if (!charId) return;
    
    // 借用 chat.js 的渲染逻辑，但挂载到 musicChatHistory 容器
    const originalHistoryEl = document.getElementById('chatRoomHistory');
    const musicHistoryEl = document.getElementById('musicChatHistory');
    
    // 临时替换 ID 欺骗 renderChatHistory
    originalHistoryEl.id = 'chatRoomHistory_temp';
    musicHistoryEl.id = 'chatRoomHistory';
    
    renderChatHistory(charId, false);
    
    // 恢复 ID
    musicHistoryEl.id = 'musicChatHistory';
    originalHistoryEl.id = 'chatRoomHistory';
    
    // 强制修改气泡颜色适应深色背景
    const bubbles = musicHistoryEl.querySelectorAll('.cr-bubble-left');
    bubbles.forEach(b => { b.style.backgroundColor = 'rgba(255,255,255,0.1)'; b.style.color = '#fff'; });
}

function sendMusicChatMessage() {
    const input = document.getElementById('musicChatInput');
    const text = input.value.trim();
    if (!text) return;

    const currentLoginId = ChatDB.getItem('current_login_account');
    const charId = window.currentListenTogetherCharId;
    if (!currentLoginId || !charId) return;

    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
    history.push({ role: 'user', type: 'text', content: text, timestamp: Date.now() });
    ChatDB.setItem(`chat_history_${currentLoginId}_${charId}`, JSON.stringify(history));

    let sessions = JSON.parse(ChatDB.getItem(`chat_sessions_${currentLoginId}`) || '[]');
    sessions = sessions.filter(id => id !== charId);
    sessions.unshift(charId);
    ChatDB.setItem(`chat_sessions_${currentLoginId}`, JSON.stringify(sessions));

    input.value = '';
    renderMusicChatHistory();
    
    // 同步刷新主聊天室（如果它在后台开着的话）
    if (document.getElementById('chatRoomPanel') && document.getElementById('chatRoomPanel').style.display === 'flex' && typeof currentChatRoomCharId !== 'undefined' && currentChatRoomCharId === charId) {
        if (typeof renderChatHistory === 'function') renderChatHistory(charId);
    }
    // 已移除自动触发 AI 的逻辑，交由左侧按钮手动触发
}

// 新增：音乐聊天室专属 AI 触发函数
function triggerMusicChatAI() {
    const charId = window.currentListenTogetherCharId;
    if (!charId) return alert("请先开始一起听歌！");
    if (typeof generateApiReply === 'function') {
        generateApiReply(false, charId);
    }
}

let isCapsuleVisible = false;
let isMiniPlayerExpanded = false;

// 页面加载时读取胶囊状态与播放列表
window.addEventListener('DOMContentLoaded', () => {
    // 恢复播放列表
    const savedPlaylist = localStorage.getItem('music_current_playlist');
    if (savedPlaylist) {
        try { window.currentPlaylistTracks = JSON.parse(savedPlaylist); } catch(e){}
    }
    
    const savedState = localStorage.getItem('music_capsule_visible');
    const container = document.getElementById('globalMusicCapsuleContainer');
    if (savedState === 'true' && container) {
        isCapsuleVisible = true;
        container.style.display = 'flex';
        // 延迟更新UI，等待DOM完全就绪
        setTimeout(() => updateCapsuleUI(), 500);
    } else if (container) {
        isCapsuleVisible = false;
        container.style.display = 'none';
    }
});

function toggleGlobalMusicCapsule() {
    const container = document.getElementById('globalMusicCapsuleContainer');
    isCapsuleVisible = !isCapsuleVisible;
    container.style.display = isCapsuleVisible ? 'flex' : 'none';
    localStorage.setItem('music_capsule_visible', isCapsuleVisible); // 持久化保存状态
    if (isCapsuleVisible) updateCapsuleUI();
}

function updateCapsuleUI() {
    if (!isCapsuleVisible) return;
    const titleEl = document.getElementById('gmcTitle');
    const coverEl = document.getElementById('gmcCover');
    const waveEl = document.getElementById('gmcWave');
    const togetherAvatars = document.getElementById('gmcTogetherAvatars');
    const miniCover = document.getElementById('miniPlayerCover');
    const miniTitle = document.getElementById('miniPlayerTitle');
    const miniSub = document.getElementById('miniPlayerSub');
    const miniLyric = document.getElementById('miniPlayerLyric');
    const miniPlayBtn2 = document.getElementById('miniPlayBtn2');
    const miniPauseBtn2 = document.getElementById('miniPauseBtn2');

    if (currentPlayingSong) {
        if (window.currentListenTogetherCharId) {
            coverEl.style.display = 'none';
            togetherAvatars.style.display = 'flex';
            const musicLoginId = ChatDB.getItem('music_current_login_account');
            let accounts = JSON.parse(ChatDB.getItem('chat_accounts') || '[]');
            const me = accounts.find(a => a.id === musicLoginId);
            let chars = JSON.parse(ChatDB.getItem('chat_chars') || '[]');
            const char = chars.find(c => c.id === window.currentListenTogetherCharId);
            if (me && me.avatarUrl) document.getElementById('gmcAvatar1').style.backgroundImage = `url(${me.avatarUrl})`;
            if (char && char.avatarUrl) document.getElementById('gmcAvatar2').style.backgroundImage = `url(${char.avatarUrl})`;
            const passedMinutes = typeof listenTogetherStartTime !== 'undefined' ? Math.floor((Date.now() - listenTogetherStartTime) / 60000) : 0;
            titleEl.innerText = `一起听 ${passedMinutes} 分钟`;
        } else {
            coverEl.style.display = 'block';
            togetherAvatars.style.display = 'none';
            coverEl.style.backgroundImage = `url(${currentPlayingSong.cover})`;
            titleEl.innerText = currentPlayingSong.title;
        }
        miniCover.style.backgroundImage = `url(${currentPlayingSong.cover})`;
        miniTitle.innerText = currentPlayingSong.title;
        miniSub.innerText = currentPlayingSong.artist;
        if (audioPlayer.paused) {
            coverEl.style.animationPlayState = 'paused';
            waveEl.style.display = 'none';
            if(miniPlayBtn2) miniPlayBtn2.style.display = 'block';
            if(miniPauseBtn2) miniPauseBtn2.style.display = 'none';
        } else {
            coverEl.style.animationPlayState = 'running';
            waveEl.style.display = 'flex';
            if(miniPlayBtn2) miniPlayBtn2.style.display = 'none';
            if(miniPauseBtn2) miniPauseBtn2.style.display = 'block';
        }
    }
}

const capsuleContainer = document.getElementById('globalMusicCapsuleContainer');
const capsuleBtn = document.getElementById('globalMusicCapsule');
let isCapsuleDragging = false;
let capStartX, capStartY, capStartLeft, capStartTop;

if (capsuleBtn && capsuleContainer) {
    capsuleBtn.addEventListener('touchstart', (e) => {
        isCapsuleDragging = true;
        capStartX = e.touches[0].clientX;
        capStartY = e.touches[0].clientY;
        
        // 获取容器中心点相对于视口左侧的距离
        const rect = capsuleContainer.getBoundingClientRect();
        capStartLeft = rect.left + rect.width / 2; 
        capStartTop = rect.top;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isCapsuleDragging) return;
        const deltaX = e.touches[0].clientX - capStartX;
        const deltaY = e.touches[0].clientY - capStartY;
        
        let newLeft = capStartLeft + deltaX;
        let newTop = capStartTop + deltaY;
        
        // 边界限制 (以中心点为基准)
        const halfWidth = capsuleContainer.offsetWidth / 2;
        if (newLeft - halfWidth < 0) newLeft = halfWidth;
        if (newTop < 20) newTop = 20;
        if (newLeft + halfWidth > window.innerWidth) newLeft = window.innerWidth - halfWidth;
        if (newTop + capsuleContainer.offsetHeight > window.innerHeight) newTop = window.innerHeight - capsuleContainer.offsetHeight;
        
        // 核心修复：始终保留 translateX(-50%)，让 left 值代表中心点
        capsuleContainer.style.left = newLeft + 'px';
        capsuleContainer.style.top = newTop + 'px';
        capsuleContainer.style.transform = 'translateX(-50%)'; 
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!isCapsuleDragging) return;
        isCapsuleDragging = false;
        
        const deltaX = Math.abs(e.changedTouches ? e.changedTouches[0].clientX - capStartX : 0);
        const deltaY = Math.abs(e.changedTouches ? e.changedTouches[0].clientY - capStartY : 0);
        
        if (deltaX < 5 && deltaY < 5) {
            const miniPlayer = document.getElementById('miniMusicPlayer');
            isMiniPlayerExpanded = !isMiniPlayerExpanded;
            miniPlayer.style.display = isMiniPlayerExpanded ? 'flex' : 'none';
        }
    });
}
// 页面加载时恢复一起听歌状态
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const savedCharId = ChatDB.getItem('music_listen_together_charId');
        const savedStartTime = ChatDB.getItem('music_listen_together_startTime');
        
        if (savedCharId && savedStartTime) {
            window.restoredListenStartTime = parseInt(savedStartTime);
            if (typeof window.startListenTogether === 'function') {
                window.startListenTogether(savedCharId);
            }
        }
    }, 1000); // 延迟等待 DOM 和数据就绪
});
// ==========================================
// 【新增】：角色最近播放与心声逻辑
// ==========================================
function openCharRecentMusic(charId) {
    let recentPlaylist = JSON.parse(ChatDB.getItem(`music_recent_${charId}`) || 'null');
    
    // 如果没有数据，构造一个空的占位歌单，而不是自动生成
    if (!recentPlaylist || !recentPlaylist.tracks) {
        let allEntities = getAllEntities();
        const char = allEntities.find(c => c.id === charId);
        recentPlaylist = {
            id: 'recent',
            name: '最近播放',
            cover: char ? (char.avatarUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg') : 'https://p2.music.126.net/6y-7YvS_G8V8.jpg',
            trackCount: 0,
            tracks: []
        };
    }
    
    // 伪装成一个普通的歌单对象，传给 openPlaylistDetail 渲染
    let tempPlaylists = JSON.parse(ChatDB.getItem(`music_playlists_${charId}`) || '[]');
    // 临时把 recent 塞进去供渲染读取，渲染完再删掉
    tempPlaylists.push(recentPlaylist);
    ChatDB.setItem(`music_playlists_${charId}`, JSON.stringify(tempPlaylists));
    
    openPlaylistDetail('recent', true, charId);
    
    // 渲染完后清理掉临时的
    tempPlaylists = tempPlaylists.filter(p => p.id !== 'recent');
    ChatDB.setItem(`music_playlists_${charId}`, JSON.stringify(tempPlaylists));
}

async function generateCharRecentMusicAPI(charId) {
    const apiConfig = JSON.parse(ChatDB.getItem('current_api_config') || '{}');
    if (!apiConfig.url || !apiConfig.key || !apiConfig.model) {
        return alert('请先在 Chat 设置中配置 API 信息！');
    }

    let allEntities = getAllEntities();
    const char = allEntities.find(c => c.id === charId);
    if (!char) return;

    const currentLoginId = ChatDB.getItem('current_login_account');
    let history = JSON.parse(ChatDB.getItem(`chat_history_${currentLoginId}_${charId}`) || '[]');
    let recentHistory = history.slice(-15).map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`).join('\n');

    const prompt = `你是一个情感细腻的音乐分析师。请根据角色【${char.name}】的设定以及TA最近的聊天记录，推测TA最近的心境，并生成一份TA最近单曲循环最多的 10 首真实存在的歌曲。
【角色设定】：${char.description || '无'}
【最近聊天记录】：
${recentHistory || '暂无聊天记录'}

要求：
1. 必须返回合法的 JSON 对象。
2. 包含 songs 数组，每首歌包含 title(歌名)、artist(歌手) 和 innerVoice(心声)。
3. innerVoice(心声) 是角色听这首歌时的内心独白，解释TA为什么听这首歌，心情如何（第一人称，简短感性，10-30字）。
4. 歌曲必须是现实中真实存在的知名歌曲。

JSON 格式示例：
{
  "songs": [
    {"title": "夜曲", "artist": "周杰伦", "innerVoice": "最近总是想起以前的事，这旋律太适合现在的雨夜了。"},
    {"title": "Creep", "artist": "Radiohead", "innerVoice": "感觉自己像个局外人，只有这首歌懂我。"}
  ]
}`;

    if (typeof showToast === 'function') showToast('正在窥探TA的最近听歌心境...', 'loading');

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
            if (!parsed.songs) throw new Error("JSON 格式不正确");

            const recentPlaylist = {
                id: 'recent',
                name: '最近播放',
                cover: char.avatarUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg',
                trackCount: parsed.songs.length,
                tracks: parsed.songs.map(s => ({
                    id: 'gen_recent_' + Date.now() + Math.random(),
                    title: s.title,
                    artist: s.artist,
                    innerVoice: s.innerVoice,
                    isGenerated: true,
                    cover: char.avatarUrl || 'https://p2.music.126.net/6y-7YvS_G8V8.jpg'
                }))
            };

            ChatDB.setItem(`music_recent_${charId}`, JSON.stringify(recentPlaylist));

            if (typeof hideToast === 'function') hideToast();
            
            openCharRecentMusic(charId);
            
        } else {
            throw new Error("API 请求失败");
        }
    } catch (e) {
        if (typeof hideToast === 'function') hideToast();
        alert('生成失败，请检查 API 配置或重试。\n' + e.message);
    }
}
