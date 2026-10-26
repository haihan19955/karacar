// UI strings for the five supported languages. Missing keys fall back to English.
window.I18N = (function () {
  const LANGS = { en: 'English', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', ja: '日本語', ko: '한국어' };

  const D = {
    en: {
      nav_search: 'Search', nav_library: 'Playlists', nav_hot: 'Hot songs', nav_guests: 'Passengers', nav_player: 'Now singing',
      search_placeholder: 'Song, artist or a line of lyrics…', search_btn: 'Search', searching: 'Searching YouTube…',
      no_results: 'No results. Try another keyword.', search_error: 'Search failed. Check the connection and try again.',
      search_hint_title: 'What do you want to sing?', search_hint: 'Search any song on YouTube. Tip: add “karaoke” or “lyrics” to find versions that allow playback.',
      play_now: 'Play', play_next: 'Next', add_queue: 'Queue', add_playlist: 'Save',
      toast_playing_next: 'Plays next: {title}', toast_queued: 'Added to queue: {title}', toast_saved: 'Saved to {name}', toast_already: 'Already in {name}',
      library_title: 'Playlists', new_playlist: 'New playlist', playlist_name_prompt: 'Playlist name', default_playlist: 'Favorites',
      rename: 'Rename', delete: 'Delete', delete_confirm: 'Delete playlist “{name}”?', play_all: 'Play all', shuffle: 'Shuffle',
      fetch_all_lyrics: 'Get all lyrics', empty_playlist: 'This playlist is empty. Search for songs and tap “Save”.', songs_count: '{n} songs',
      remove: 'Remove', fetch_all_progress: 'Getting lyrics {i}/{n}…', fetch_all_done: 'Lyrics ready for {ok} of {n} songs',
      lyr_word: 'Word sync', lyr_line: 'Line sync', lyr_none: 'No lyrics', fetch_lyrics: 'Get lyrics', fetching_lyrics: 'Finding lyrics…',
      lyrics_not_found: 'No synced lyrics found', lyrics_not_found_hint: 'Tap “Lyrics” to search with a different song name.',
      choose_lyrics: 'Choose lyrics', lyrics_source: 'Lyrics', manual_search: 'Song name + artist', remove_lyrics: 'Remove lyrics', use_this: 'Use',
      lyrics_offset: 'Offset', tap_to_sync: 'Tap any line to sync it to now', synced_toast: 'Synced to this line', in_use: 'In use',
      lyrics_removed: 'Lyrics removed', sec_diff: '{d}s off',
      mode_video: 'Video', mode_lyrics: 'Lyrics', mode_karaoke: 'Karaoke',
      up_next: 'Up next', nothing_queued: 'Nothing queued — add a song to play next.', autoplay: 'Auto-play', clear: 'Clear',
      nothing_playing: 'Nothing playing yet', nothing_playing_hint: 'Pick a song from Search, Playlists or Hot songs.',
      interlude: 'Interlude', end_of_queue: 'End of the queue',
      hot_title: 'Hot karaoke songs', hot_hint: 'Tap a song to pick a version on YouTube.',
      cat_mandarin: 'Mandopop', cat_classic: 'Mandarin classics', cat_cantonese: 'Cantopop', cat_japanese: 'J-Pop', cat_korean: 'K-Pop', cat_english: 'English',
      guests_title: 'Passengers add songs', guests_sub: 'Passengers scan the code with their phone camera to add songs to the queue — no app, no login.',
      guests_expires: 'Expires in', guests_refresh: 'New code', guests_expired: 'Code expired', guests_creating: 'Creating code…',
      guests_step1: 'Scan the QR code with a phone camera', guests_step2: 'Search a song and tap “Add”', guests_step3: 'It shows up in Up next here',
      guests_log: 'Recent requests', guests_none: 'No requests yet.', guests_error: 'Could not create a code. Check the connection.',
      guest_request_toast: '🎤 {by} added {title}', guest_anonymous: 'A passenger',
      embed_blocked: 'This video can’t be played outside YouTube. Skipping — try another version.', video_error: 'Video failed to load. Skipping.',
      fullscreen: 'Full screen', tesla_fullscreen: 'Tesla full screen', driving_hint: 'Video paused by the car — switched to Lyrics mode, audio keeps playing.',
      settings: 'Settings', language: 'Language', lyric_size: 'Lyrics size', size_s: 'S', size_m: 'M', size_l: 'L',
      sync_title: 'Sync across devices', sync_desc: 'Enter the same sync code on your phone, computer and car to share playlists.',
      sync_code: 'Your sync code', sync_enter: 'Enter a sync code', sync_link: 'Link', sync_linked: 'Playlists synced', sync_bad: 'Sync code not found',
      sync_start: 'Turn on sync', sync_off: 'Turn off',
      tesla_tip: 'Tesla tip: “Tesla full screen” reopens the app through YouTube so the browser bar disappears.',
      cancel: 'Cancel', ok: 'OK', close: 'Close', save: 'Save',
      g_title: 'Add a song', g_sub: 'Your song will play on the car screen.', g_name_ph: 'Your name (optional)', g_add: 'Add', g_next: 'Next', g_added: 'Added! 🎉',
      g_expired: 'This code has expired. Ask the driver to show a new QR code.', g_queue: 'Up next', g_now: 'Now singing', g_connecting: 'Connecting to the car…'
    },
    'zh-CN': {
      nav_search: '搜索', nav_library: '歌单', nav_hot: '热门', nav_guests: '乘客点歌', nav_player: '演唱中',
      search_placeholder: '歌名、歌手或一句歌词…', search_btn: '搜索', searching: '正在搜索 YouTube…',
      no_results: '没有结果，换个关键词试试。', search_error: '搜索失败，请检查网络后重试。',
      search_hint_title: '今天想唱什么？', search_hint: '搜索 YouTube 上的任何歌曲。小技巧：加上「KTV」或「歌词」更容易找到可播放的版本。',
      play_now: '播放', play_next: '下一首', add_queue: '排队', add_playlist: '收藏',
      toast_playing_next: '下一首播放：{title}', toast_queued: '已加入队列：{title}', toast_saved: '已收藏到 {name}', toast_already: '已经在 {name} 里了',
      library_title: '我的歌单', new_playlist: '新建歌单', playlist_name_prompt: '歌单名称', default_playlist: '我的最爱',
      rename: '重命名', delete: '删除', delete_confirm: '删除歌单「{name}」？', play_all: '全部播放', shuffle: '随机播放',
      fetch_all_lyrics: '一键获取歌词', empty_playlist: '歌单还是空的。去搜索歌曲，点「收藏」加入。', songs_count: '{n} 首',
      remove: '移除', fetch_all_progress: '正在获取歌词 {i}/{n}…', fetch_all_done: '{n} 首中 {ok} 首已有歌词',
      lyr_word: '逐字', lyr_line: '逐行', lyr_none: '无歌词', fetch_lyrics: '获取歌词', fetching_lyrics: '正在查找歌词…',
      lyrics_not_found: '没有找到同步歌词', lyrics_not_found_hint: '点「歌词」换个歌名重新搜索。',
      choose_lyrics: '选择歌词', lyrics_source: '歌词', manual_search: '歌名 + 歌手', remove_lyrics: '删除歌词', use_this: '使用',
      lyrics_offset: '偏移', tap_to_sync: '点击任意一行，把它同步到当前时间', synced_toast: '已同步到这一行', in_use: '使用中',
      lyrics_removed: '歌词已删除', sec_diff: '相差 {d} 秒',
      mode_video: '视频', mode_lyrics: '歌词', mode_karaoke: '卡拉OK',
      up_next: '接下来', nothing_queued: '队列是空的——加一首歌吧。', autoplay: '自动连播', clear: '清空',
      nothing_playing: '还没有播放歌曲', nothing_playing_hint: '从搜索、歌单或热门里选一首开唱。',
      interlude: '间奏', end_of_queue: '队列已播完',
      hot_title: '热门K歌', hot_hint: '点一首歌，在 YouTube 上选择版本。',
      cat_mandarin: '华语流行', cat_classic: '华语经典', cat_cantonese: '粤语', cat_japanese: '日语', cat_korean: '韩语', cat_english: '英文',
      guests_title: '乘客扫码点歌', guests_sub: '乘客用手机相机扫码即可点歌加入队列——无需安装，无需登录。',
      guests_expires: '有效期', guests_refresh: '换一个码', guests_expired: '二维码已过期', guests_creating: '正在生成二维码…',
      guests_step1: '用手机相机扫描二维码', guests_step2: '搜索歌曲，点「点歌」', guests_step3: '歌曲会出现在这里的「接下来」',
      guests_log: '最近点歌', guests_none: '还没有人点歌。', guests_error: '无法生成二维码，请检查网络。',
      guest_request_toast: '🎤 {by} 点了 {title}', guest_anonymous: '乘客',
      embed_blocked: '该视频禁止在 YouTube 以外播放，已跳过——换个版本试试。', video_error: '视频加载失败，已跳过。',
      fullscreen: '全屏', tesla_fullscreen: '特斯拉全屏', driving_hint: '行驶中视频被车辆暂停——已切换到歌词模式，音乐继续播放。',
      settings: '设置', language: '语言', lyric_size: '歌词字号', size_s: '小', size_m: '中', size_l: '大',
      sync_title: '多设备同步', sync_desc: '在手机、电脑和车上输入同一个同步码，即可共享歌单。',
      sync_code: '你的同步码', sync_enter: '输入同步码', sync_link: '连接', sync_linked: '歌单已同步', sync_bad: '找不到这个同步码',
      sync_start: '开启同步', sync_off: '关闭',
      tesla_tip: '特斯拉小技巧：「特斯拉全屏」会通过 YouTube 重新打开本页，隐藏浏览器地址栏。',
      cancel: '取消', ok: '确定', close: '关闭', save: '保存',
      g_title: '点一首歌', g_sub: '你点的歌会在车机屏幕上播放。', g_name_ph: '你的名字（可选）', g_add: '点歌', g_next: '插播', g_added: '点歌成功！🎉',
      g_expired: '二维码已过期，请让司机刷新二维码。', g_queue: '接下来', g_now: '正在演唱', g_connecting: '正在连接车机…'
    },
    'zh-TW': {
      nav_search: '搜尋', nav_library: '歌單', nav_hot: '熱門', nav_guests: '乘客點歌', nav_player: '演唱中',
      search_placeholder: '歌名、歌手或一句歌詞…', search_btn: '搜尋', searching: '正在搜尋 YouTube…',
      no_results: '沒有結果，換個關鍵字試試。', search_error: '搜尋失敗，請檢查網路後重試。',
      search_hint_title: '今天想唱什麼？', search_hint: '搜尋 YouTube 上的任何歌曲。小技巧：加上「KTV」或「歌詞」更容易找到可播放的版本。',
      play_now: '播放', play_next: '下一首', add_queue: '排隊', add_playlist: '收藏',
      toast_playing_next: '下一首播放：{title}', toast_queued: '已加入佇列：{title}', toast_saved: '已收藏到 {name}', toast_already: '已經在 {name} 裡了',
      library_title: '我的歌單', new_playlist: '新增歌單', playlist_name_prompt: '歌單名稱', default_playlist: '我的最愛',
      rename: '重新命名', delete: '刪除', delete_confirm: '刪除歌單「{name}」？', play_all: '全部播放', shuffle: '隨機播放',
      fetch_all_lyrics: '一鍵取得歌詞', empty_playlist: '歌單還是空的。去搜尋歌曲，點「收藏」加入。', songs_count: '{n} 首',
      remove: '移除', fetch_all_progress: '正在取得歌詞 {i}/{n}…', fetch_all_done: '{n} 首中 {ok} 首已有歌詞',
      lyr_word: '逐字', lyr_line: '逐行', lyr_none: '無歌詞', fetch_lyrics: '取得歌詞', fetching_lyrics: '正在尋找歌詞…',
      lyrics_not_found: '沒有找到同步歌詞', lyrics_not_found_hint: '點「歌詞」換個歌名重新搜尋。',
      choose_lyrics: '選擇歌詞', lyrics_source: '歌詞', manual_search: '歌名 + 歌手', remove_lyrics: '刪除歌詞', use_this: '使用',
      lyrics_offset: '偏移', tap_to_sync: '點擊任意一行，把它同步到目前時間', synced_toast: '已同步到這一行', in_use: '使用中',
      lyrics_removed: '歌詞已刪除', sec_diff: '相差 {d} 秒',
      mode_video: '影片', mode_lyrics: '歌詞', mode_karaoke: '卡拉OK',
      up_next: '接下來', nothing_queued: '佇列是空的——加一首歌吧。', autoplay: '自動連播', clear: '清空',
      nothing_playing: '還沒有播放歌曲', nothing_playing_hint: '從搜尋、歌單或熱門裡選一首開唱。',
      interlude: '間奏', end_of_queue: '佇列已播完',
      hot_title: '熱門K歌', hot_hint: '點一首歌，在 YouTube 上選擇版本。',
      cat_mandarin: '華語流行', cat_classic: '華語經典', cat_cantonese: '粵語', cat_japanese: '日語', cat_korean: '韓語', cat_english: '英文',
      guests_title: '乘客掃碼點歌', guests_sub: '乘客用手機相機掃碼即可點歌加入佇列——免安裝、免登入。',
      guests_expires: '有效期', guests_refresh: '換一個碼', guests_expired: 'QR 碼已過期', guests_creating: '正在產生 QR 碼…',
      guests_step1: '用手機相機掃描 QR 碼', guests_step2: '搜尋歌曲，點「點歌」', guests_step3: '歌曲會出現在這裡的「接下來」',
      guests_log: '最近點歌', guests_none: '還沒有人點歌。', guests_error: '無法產生 QR 碼，請檢查網路。',
      guest_request_toast: '🎤 {by} 點了 {title}', guest_anonymous: '乘客',
      embed_blocked: '此影片禁止在 YouTube 以外播放，已跳過——換個版本試試。', video_error: '影片載入失敗，已跳過。',
      fullscreen: '全螢幕', tesla_fullscreen: '特斯拉全螢幕', driving_hint: '行駛中影片被車輛暫停——已切換到歌詞模式，音樂繼續播放。',
      settings: '設定', language: '語言', lyric_size: '歌詞字級', size_s: '小', size_m: '中', size_l: '大',
      sync_title: '多裝置同步', sync_desc: '在手機、電腦和車上輸入同一個同步碼，即可共享歌單。',
      sync_code: '你的同步碼', sync_enter: '輸入同步碼', sync_link: '連結', sync_linked: '歌單已同步', sync_bad: '找不到這個同步碼',
      sync_start: '開啟同步', sync_off: '關閉',
      tesla_tip: '特斯拉小技巧：「特斯拉全螢幕」會透過 YouTube 重新開啟本頁，隱藏瀏覽器網址列。',
      cancel: '取消', ok: '確定', close: '關閉', save: '儲存',
      g_title: '點一首歌', g_sub: '你點的歌會在車機螢幕上播放。', g_name_ph: '你的名字（選填）', g_add: '點歌', g_next: '插播', g_added: '點歌成功！🎉',
      g_expired: 'QR 碼已過期，請讓駕駛重新整理 QR 碼。', g_queue: '接下來', g_now: '正在演唱', g_connecting: '正在連線車機…'
    },
    ja: {
      nav_search: '検索', nav_library: 'プレイリスト', nav_hot: '人気曲', nav_guests: '同乗者リクエスト', nav_player: '歌唱中',
      search_placeholder: '曲名・アーティスト・歌詞の一節…', search_btn: '検索', searching: 'YouTube を検索中…',
      no_results: '見つかりませんでした。別のキーワードでお試しください。', search_error: '検索に失敗しました。通信状況を確認してください。',
      search_hint_title: '何を歌いますか？', search_hint: 'YouTube のあらゆる曲を検索できます。「カラオケ」「歌詞」を付けると再生できる動画が見つかりやすくなります。',
      play_now: '再生', play_next: '次に再生', add_queue: '予約', add_playlist: '保存',
      toast_playing_next: '次に再生：{title}', toast_queued: '予約しました：{title}', toast_saved: '{name} に保存しました', toast_already: 'すでに {name} にあります',
      library_title: 'プレイリスト', new_playlist: '新規プレイリスト', playlist_name_prompt: 'プレイリスト名', default_playlist: 'お気に入り',
      rename: '名前を変更', delete: '削除', delete_confirm: '「{name}」を削除しますか？', play_all: 'すべて再生', shuffle: 'シャッフル',
      fetch_all_lyrics: '歌詞を一括取得', empty_playlist: 'まだ曲がありません。検索して「保存」をタップしてください。', songs_count: '{n} 曲',
      remove: '削除', fetch_all_progress: '歌詞を取得中 {i}/{n}…', fetch_all_done: '{n} 曲中 {ok} 曲の歌詞を取得しました',
      lyr_word: '文字同期', lyr_line: '行同期', lyr_none: '歌詞なし', fetch_lyrics: '歌詞を取得', fetching_lyrics: '歌詞を検索中…',
      lyrics_not_found: '同期歌詞が見つかりません', lyrics_not_found_hint: '「歌詞」から曲名を変えて検索できます。',
      choose_lyrics: '歌詞を選択', lyrics_source: '歌詞', manual_search: '曲名 + アーティスト', remove_lyrics: '歌詞を削除', use_this: '使う',
      lyrics_offset: 'ずれ補正', tap_to_sync: '行をタップすると、その行を現在位置に合わせます', synced_toast: 'この行に合わせました', in_use: '使用中',
      lyrics_removed: '歌詞を削除しました', sec_diff: '{d} 秒差',
      mode_video: '動画', mode_lyrics: '歌詞', mode_karaoke: 'カラオケ',
      up_next: '次の曲', nothing_queued: '予約はありません。曲を追加しましょう。', autoplay: '自動再生', clear: 'クリア',
      nothing_playing: 'まだ再生していません', nothing_playing_hint: '検索・プレイリスト・人気曲から選んでください。',
      interlude: '間奏', end_of_queue: '予約曲をすべて再生しました',
      hot_title: 'カラオケ人気曲', hot_hint: '曲をタップして YouTube のバージョンを選びます。',
      cat_mandarin: '華語ポップ', cat_classic: '華語クラシック', cat_cantonese: '広東語', cat_japanese: 'J-POP', cat_korean: 'K-POP', cat_english: '洋楽',
      guests_title: '同乗者が曲を追加', guests_sub: 'スマホのカメラで QR コードを読み取るだけで曲を予約できます。アプリもログインも不要。',
      guests_expires: '有効期限', guests_refresh: 'コードを更新', guests_expired: 'コードの有効期限切れ', guests_creating: 'コードを作成中…',
      guests_step1: 'スマホのカメラで QR コードを読み取る', guests_step2: '曲を検索して「追加」をタップ', guests_step3: 'ここの「次の曲」に表示されます',
      guests_log: '最近のリクエスト', guests_none: 'まだリクエストはありません。', guests_error: 'コードを作成できません。通信状況を確認してください。',
      guest_request_toast: '🎤 {by} が {title} を追加', guest_anonymous: '同乗者',
      embed_blocked: 'この動画は YouTube 以外で再生できません。スキップします。別のバージョンをお試しください。', video_error: '動画を読み込めませんでした。スキップします。',
      fullscreen: '全画面', tesla_fullscreen: 'Tesla 全画面', driving_hint: '走行中は動画が停止されるため、歌詞モードに切り替えました。音声は続きます。',
      settings: '設定', language: '言語', lyric_size: '歌詞の大きさ', size_s: '小', size_m: '中', size_l: '大',
      sync_title: 'デバイス間で同期', sync_desc: 'スマホ・PC・車で同じ同期コードを入力するとプレイリストを共有できます。',
      sync_code: 'あなたの同期コード', sync_enter: '同期コードを入力', sync_link: '接続', sync_linked: 'プレイリストを同期しました', sync_bad: '同期コードが見つかりません',
      sync_start: '同期をオン', sync_off: 'オフ',
      tesla_tip: 'Tesla のヒント：「Tesla 全画面」は YouTube 経由でページを開き直し、アドレスバーを隠します。',
      cancel: 'キャンセル', ok: 'OK', close: '閉じる', save: '保存',
      g_title: '曲をリクエスト', g_sub: 'リクエストした曲は車の画面で再生されます。', g_name_ph: 'お名前（任意）', g_add: '追加', g_next: '割り込み', g_added: '追加しました！🎉',
      g_expired: 'コードの有効期限が切れました。運転手に新しい QR コードを表示してもらってください。', g_queue: '次の曲', g_now: '歌唱中', g_connecting: '車に接続中…'
    },
    ko: {
      nav_search: '검색', nav_library: '플레이리스트', nav_hot: '인기곡', nav_guests: '동승자 신청곡', nav_player: '부르는 중',
      search_placeholder: '노래 제목, 가수 또는 가사 한 줄…', search_btn: '검색', searching: 'YouTube 검색 중…',
      no_results: '결과가 없습니다. 다른 키워드로 검색해 보세요.', search_error: '검색에 실패했습니다. 연결 상태를 확인하세요.',
      search_hint_title: '무엇을 부를까요?', search_hint: 'YouTube의 모든 노래를 검색하세요. “노래방”이나 “가사”를 붙이면 재생 가능한 영상을 찾기 쉬워요.',
      play_now: '재생', play_next: '다음 곡', add_queue: '예약', add_playlist: '저장',
      toast_playing_next: '다음에 재생: {title}', toast_queued: '예약됨: {title}', toast_saved: '{name}에 저장했습니다', toast_already: '이미 {name}에 있습니다',
      library_title: '플레이리스트', new_playlist: '새 플레이리스트', playlist_name_prompt: '플레이리스트 이름', default_playlist: '즐겨찾기',
      rename: '이름 변경', delete: '삭제', delete_confirm: '“{name}” 플레이리스트를 삭제할까요?', play_all: '모두 재생', shuffle: '셔플',
      fetch_all_lyrics: '가사 한 번에 받기', empty_playlist: '아직 비어 있어요. 노래를 검색하고 “저장”을 누르세요.', songs_count: '{n}곡',
      remove: '삭제', fetch_all_progress: '가사 가져오는 중 {i}/{n}…', fetch_all_done: '{n}곡 중 {ok}곡 가사 준비 완료',
      lyr_word: '글자 싱크', lyr_line: '줄 싱크', lyr_none: '가사 없음', fetch_lyrics: '가사 받기', fetching_lyrics: '가사 찾는 중…',
      lyrics_not_found: '싱크 가사를 찾지 못했습니다', lyrics_not_found_hint: '“가사”를 눌러 다른 제목으로 검색해 보세요.',
      choose_lyrics: '가사 선택', lyrics_source: '가사', manual_search: '제목 + 가수', remove_lyrics: '가사 삭제', use_this: '사용',
      lyrics_offset: '싱크 조절', tap_to_sync: '아무 줄이나 누르면 그 줄을 현재 위치에 맞춥니다', synced_toast: '이 줄에 맞췄습니다', in_use: '사용 중',
      lyrics_removed: '가사를 삭제했습니다', sec_diff: '{d}초 차이',
      mode_video: '영상', mode_lyrics: '가사', mode_karaoke: '노래방',
      up_next: '다음 곡', nothing_queued: '예약된 곡이 없습니다. 노래를 추가하세요.', autoplay: '자동 재생', clear: '비우기',
      nothing_playing: '아직 재생 중인 곡이 없습니다', nothing_playing_hint: '검색, 플레이리스트, 인기곡에서 골라 보세요.',
      interlude: '간주', end_of_queue: '예약곡을 모두 재생했습니다',
      hot_title: '노래방 인기곡', hot_hint: '노래를 누르면 YouTube에서 버전을 고를 수 있어요.',
      cat_mandarin: '중국 팝', cat_classic: '중국 명곡', cat_cantonese: '광둥어', cat_japanese: 'J-POP', cat_korean: 'K-POP', cat_english: '팝송',
      guests_title: '동승자가 곡 추가', guests_sub: '휴대폰 카메라로 QR 코드를 찍으면 바로 곡을 예약할 수 있어요. 앱도 로그인도 필요 없습니다.',
      guests_expires: '남은 시간', guests_refresh: '새 코드', guests_expired: '코드가 만료되었습니다', guests_creating: '코드 만드는 중…',
      guests_step1: '휴대폰 카메라로 QR 코드 스캔', guests_step2: '노래를 검색하고 “추가” 누르기', guests_step3: '여기 “다음 곡”에 나타납니다',
      guests_log: '최근 신청곡', guests_none: '아직 신청곡이 없습니다.', guests_error: '코드를 만들 수 없습니다. 연결 상태를 확인하세요.',
      guest_request_toast: '🎤 {by}님이 {title} 추가', guest_anonymous: '동승자',
      embed_blocked: '이 영상은 YouTube 밖에서 재생할 수 없어 건너뜁니다. 다른 버전을 찾아보세요.', video_error: '영상을 불러오지 못해 건너뜁니다.',
      fullscreen: '전체 화면', tesla_fullscreen: '테슬라 전체 화면', driving_hint: '주행 중에는 영상이 멈춰 가사 모드로 전환했습니다. 소리는 계속 나옵니다.',
      settings: '설정', language: '언어', lyric_size: '가사 크기', size_s: '작게', size_m: '보통', size_l: '크게',
      sync_title: '기기 간 동기화', sync_desc: '휴대폰, 컴퓨터, 차에서 같은 동기화 코드를 입력하면 플레이리스트를 공유합니다.',
      sync_code: '내 동기화 코드', sync_enter: '동기화 코드 입력', sync_link: '연결', sync_linked: '플레이리스트를 동기화했습니다', sync_bad: '동기화 코드를 찾을 수 없습니다',
      sync_start: '동기화 켜기', sync_off: '끄기',
      tesla_tip: '테슬라 팁: “테슬라 전체 화면”은 YouTube를 거쳐 페이지를 다시 열어 주소창을 숨깁니다.',
      cancel: '취소', ok: '확인', close: '닫기', save: '저장',
      g_title: '노래 신청', g_sub: '신청한 노래는 차 화면에서 재생됩니다.', g_name_ph: '이름 (선택)', g_add: '추가', g_next: '바로 다음', g_added: '추가했어요! 🎉',
      g_expired: '코드가 만료되었습니다. 운전자에게 새 QR 코드를 요청하세요.', g_queue: '다음 곡', g_now: '부르는 중', g_connecting: '차에 연결 중…'
    }
  };

  function detect() {
    try {
      const qs = new URLSearchParams(location.search).get('lang');
      if (qs && D[qs]) return qs;
      const saved = localStorage.getItem('kc.lang');
      if (saved && D[saved]) return saved;
    } catch (e) { /* storage blocked */ }
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('zh')) return /tw|hk|mo|hant/.test(nav) ? 'zh-TW' : 'zh-CN';
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('ko')) return 'ko';
    return 'en';
  }

  let lang = detect();

  function t(key, vars) {
    let s = (D[lang] && D[lang][key]) || D.en[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }

  function apply(root) {
    document.documentElement.lang = lang;
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  }

  function set(l) {
    if (!D[l]) return;
    lang = l;
    try { localStorage.setItem('kc.lang', l); } catch (e) { /* ignore */ }
    apply();
  }

  return { LANGS, t, apply, set, get lang() { return lang; } };
})();
