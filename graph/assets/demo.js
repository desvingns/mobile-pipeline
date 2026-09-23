(function () {
  'use strict';
  var story = window.MP_STORY, videoInfo = window.MP_VIDEO;
  var stages = story.stages, mode = 'simple', stageIndex = 0, selectedRef = null;
  var timers = [], running = false, states = {}, favorite = true, pendingSeek = null;
  var frameRoute = '', lastFocus = null, currentRole = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var types = {agent:'ИИ-специалист',human:'Человек',script:'Автопроверка',artifact:'Результат'};
  var paths = {
    person:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    route:'<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v9h9M9 6h9v9"/>',
    screen:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4M3 7h18"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
    document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h6"/>',
    search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="7" cy="14" r="1"/><path d="M20 14h-5v6"/>',
    code:'<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    play:'<path d="m8 3 13 9-13 9z"/>',
    alert:'<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.route)+'</svg>'; }
  function stage() { return stages[stageIndex]; }
  function timeLabel(sec) { return Math.floor(sec/60)+':'+String(Math.floor(sec%60)).padStart(2,'0'); }
  function nodeState(label) { return label==='Работает'?'running':label==='Готово'?'done':label==='Нужно решение человека'?'human':'waiting'; }
  function chapterTime(i) { return videoInfo.chapters[i] || 0; }

  function parseRoute(hash) {
    var parts = hash.replace(/^#/,'').split('/');
    var found = stages.findIndex(function(s){return s.id===parts[1];});
    if (['simple','guided','presentation','details'].indexOf(parts[0])>=0) {
      return {mode:parts[0],index:found<0?0:found,ref:parts[0]==='details' && parts[2] ? parts.slice(2,5) : null};
    }
    if (!hash || hash==='#' || hash==='#overview/all') return {mode:'simple',index:0,ref:null};
    if (['overview','mp-spec','mp-dev'].indexOf(parts[0])>=0) {
      var index=stages.findIndex(function(s){return s.participants.some(function(p){return p.ref[0]===parts[0] && p.ref[2]===parts[2];});});
      return {mode:'details',index:Math.max(0,index),ref:parts.slice(0,3)};
    }
    return {mode:'simple',index:0,ref:null};
  }
  function routeHash() { return '#'+mode+'/'+stage().id+(mode==='details'?'/'+(selectedRef||[stage().graph,stage().flow,stage().focus]).join('/'):''); }
  function navigate(nextMode,index,ref,replace) {
    cancelSimulation();
    if (mode==='presentation' && nextMode!=='presentation') $('presentation-video').pause();
    mode=nextMode;stageIndex=Math.max(0,Math.min(stages.length-1,index));selectedRef=ref||null;
    if (mode==='presentation') pendingSeek=chapterTime(stageIndex);
    var hash=routeHash();
    try { window.history[replace?'replaceState':'pushState'](null,'',hash); } catch(e) { window.location.hash=hash; }
    render();
  }
  function readRoute() {
    if (location.hash==='#main-content') return;
    var route=parseRoute(location.hash);cancelSimulation();
    if(mode==='presentation' && route.mode!=='presentation') $('presentation-video').pause();
    mode=route.mode;stageIndex=route.index;selectedRef=route.ref;
    if(mode==='presentation') pendingSeek=chapterTime(stageIndex);
    render();
  }
  function render() {
    document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    $('story-view').hidden=mode==='details'||mode==='presentation';
    $('details-view').hidden=mode!=='details';$('presentation-view').hidden=mode!=='presentation';
    $('technical-context').hidden=mode!=='guided';
    document.title=stage().label+' · Mobile Pipeline';
    if(mode==='details'){renderDetails();return;}
    if(mode==='presentation'){applyVideoSeek();updateVideoChapters();return;}
    renderStory();
  }
  function renderStory() {
    var s=stage();
    document.querySelector('.story-canvas').dataset.step=String(stageIndex+1).padStart(2,'0');
    document.querySelectorAll('[data-journey]').forEach(function(b){b.setAttribute('aria-current',Number(b.dataset.journey)===(stageIndex<3?0:stageIndex<5?1:2)?'step':'false');});
    $('chapter-nav').innerHTML=stages.map(function(v,i){return '<button data-stage="'+i+'" class="'+(i<stageIndex?'past':'')+'"'+(i===stageIndex?' aria-current="step"':'')+'><span class="chapter-number">'+String(i+1).padStart(2,'0')+'</span>'+esc(v.label)+'</button>';}).join('');
    $('stage-kicker').textContent='ЭТАП '+String(stageIndex+1).padStart(2,'0')+' / 08';
    $('stage-title').textContent=s.title;$('stage-intro').textContent=s.intro;
    $('coordinator-text').textContent=s.coordinator;$('coordinator-icon').innerHTML=icon('route');
    $('flow-caption').textContent=s.parallel?'ОДНОВРЕМЕННО · ТРИ ЗАДАНИЯ':'ПО ПОРЯДКУ · КАЖДЫЙ СО СВОЕЙ ЗАДАЧЕЙ';
    $('outcome-text').textContent=s.outcome;
    $('previous').disabled=stageIndex===0;
    $('next').innerHTML=stageIndex===stages.length-1?'К началу <span aria-hidden="true">↺</span>':'Далее <span aria-hidden="true">→</span>';
    $('simulation-status').textContent='Шаг за шагом, в вашем темпе';
    $('context-text').textContent=s.detail;
    $('technical-roles').innerHTML=s.participants.map(function(p,i){return '<button class="technical-role" data-role="'+i+'"><span>'+esc(p.name)+'</span><code>'+esc(p.ref[2])+'</code></button>';}).join('');
    renderNodes();renderPhone();
  }
  function renderNodes() {
    var s=stage();$('node-flow').className='node-flow'+(s.parallel?' parallel':'');
    $('node-flow').innerHTML=s.participants.map(function(p,i){var label=states[p.id]||p.status;return '<button class="node-card '+p.type+'" data-role="'+i+'" data-state="'+nodeState(label)+'" aria-label="'+esc(p.name+'. '+p.role+'. '+label)+ '"><span class="role-icon">'+icon(p.icon)+'</span><span class="node-type">'+(p.type==='agent'?'ИИ':p.type==='human'?'ЧЕЛОВЕК':p.type==='script'?'АВТО':'ИТОГ')+'</span><h3>'+esc(p.name)+'</h3><span class="role-subtitle">'+esc(p.role)+'</span><p class="node-action">'+esc(p.action)+'</p><span class="node-status"><i></i>'+esc(label)+'</span><span class="connector" aria-hidden="true"></span></button>';}).join('');
    $('join-note').hidden=!s.parallel;
    if(s.parallel){var done=s.participants.filter(function(p){return states[p.id]==='Готово';}).length;$('join-note').textContent=done===3?'Все 3 отчёта собраны → координатор может продолжить':'Координатор ждёт все три отчёта'+(running?' · готово '+done+' из 3':'');}
  }
  function schedule(fn,ms){timers.push(setTimeout(fn,ms));}
  function cancelSimulation(){timers.forEach(clearTimeout);timers=[];running=false;states={};$('simulate').textContent='▷ Показать работу';}
  function simulate(){
    if(running){cancelSimulation();renderStory();return;}
    running=true;$('simulate').textContent='■ Остановить показ';
    $('simulation-status').textContent='Учебная анимация. Реальные агенты не запускаются.';
    var s=stage(),pace=reducedMotion.matches?0:1500;
    s.participants.forEach(function(p){states[p.id]='Ожидает';});renderNodes();
    function finish(){running=false;$('simulate').textContent='↺ Повторить показ';$('simulation-status').textContent='Этап завершён. Можно перейти дальше.';}
    if(s.parallel){
      s.participants.forEach(function(p,i){states[p.id]='Работает';schedule(function(){states[p.id]='Готово';renderNodes();if(i===s.participants.length-1)finish();},pace*(i+1));});renderNodes();
    }else{
      s.participants.forEach(function(p,i){schedule(function(){states[p.id]=p.type==='human'?'Нужно решение человека':'Работает';renderNodes();},pace*i);schedule(function(){states[p.id]='Готово';renderNodes();if(i===s.participants.length-1)finish();},pace*(i+1));});
    }
  }
  function plate(){return '<svg viewBox="0 0 240 160" aria-hidden="true"><rect width="240" height="160" fill="#e9e5d0"/><ellipse cx="120" cy="88" rx="80" ry="63" fill="#c9c5ae" opacity=".4"/><ellipse cx="120" cy="80" rx="78" ry="64" fill="#fcf9e9"/><ellipse cx="120" cy="80" rx="59" ry="46" fill="#e1dec8"/><g fill="#748b4a"><ellipse cx="91" cy="61" rx="25" ry="13" transform="rotate(-30 91 61)"/><ellipse cx="148" cy="73" rx="28" ry="14" transform="rotate(28 148 73)"/><ellipse cx="117" cy="102" rx="28" ry="13" transform="rotate(-10 117 102)"/></g><g fill="#a6b66e"><ellipse cx="125" cy="57" rx="26" ry="10" transform="rotate(25 125 57)"/><ellipse cx="92" cy="85" rx="25" ry="11" transform="rotate(45 92 85)"/></g><g fill="#cc7956"><circle cx="105" cy="65" r="10"/><circle cx="142" cy="94" r="10"/><circle cx="88" cy="93" r="8"/></g><g fill="#f6e1a5"><rect x="116" y="70" width="14" height="14" rx="3" transform="rotate(20 123 77)"/><rect x="145" y="52" width="12" height="12" rx="3" transform="rotate(-16 151 58)"/><rect x="107" y="96" width="13" height="13" rx="3"/></g><path d="m191 27-7 110m10-111-7 109" stroke="#a2a087" stroke-width="2"/><path d="m41 30 7 110" stroke="#a2a087" stroke-width="3"/></svg>';}
  function renderPhone(){
    var s=stage(),badges={preview:'Будущий результат',research:'Изучаем приложение',rules:'Решения согласованы',design:'Единый стиль',working:'Попробуйте сердечко',checks:'Проверяем поведение',repair:'Исправляем сохранение',done:'Функция принята'};
    $('phone-caption').textContent=stageIndex===0?'Вот ради чего всё начинается':'Приложение на этом этапе';
    $('phone').innerHTML='<div class="phone-top"><span>9:41</span><span>▮▮▮ ▰</span></div><span class="phone-island"></span><div class="phone-title">Мои рецепты '+icon('search')+'</div><p class="phone-subtitle">Вкусное на каждый день</p><div class="recipe-picture">'+plate()+'<button class="heart-button" id="favorite-button" aria-label="'+(favorite?'Убрать рецепт из избранного':'Добавить рецепт в избранное')+'" aria-pressed="'+favorite+'">'+icon('heart')+'</button></div><p class="recipe-name">Салат с запечённой тыквой</p><p class="recipe-info">25 минут &nbsp; · &nbsp; Просто &nbsp; · &nbsp; 2 порции</p><div class="saved-row">'+icon('heart')+'<strong>Избранное</strong><span id="favorite-count">'+(favorite?'1 рецепт':'Пока пусто')+'</span></div><div class="phone-tabs"><span class="phone-tab active">'+icon('grid')+'Рецепты</span><span class="phone-tab">'+icon('heart')+'Избранное</span><span class="phone-tab">'+icon('person')+'Профиль</span></div><div class="phone-home"></div><div class="phone-stage-badge">'+icon(stageIndex===6?'alert':'check')+esc(badges[s.phone])+'</div>';
    $('phone-footnote').textContent=stageIndex===0?'Нажмите на сердечко. Это маленький пример того, что создаёт команда.':stageIndex===6?'В учебной ветке ошибка найдена тестом. Макет показывает ожидаемое поведение.':'Учебный макет. Сердечко показывает связь между действием и результатом.';
  }
  function openRole(i){
    var p=stage().participants[i];if(!p)return;currentRole=p;lastFocus=document.activeElement;
    $('role-type').textContent=types[p.type];$('role-heading').innerHTML='<span class="role-icon">'+icon(p.icon)+'</span><div><h2 id="role-title">'+esc(p.name)+'</h2><p>'+esc(p.role)+'</p></div>';
    $('role-body').innerHTML='<dl>'+[['Когда подключается',p.when],['Что получает',p.input],['Что делает',p.action],['Что передаёт дальше',p.output]].map(function(row){return '<div class="role-detail"><dt>'+row[0]+'</dt><dd>'+esc(row[1])+'</dd></div>';}).join('')+'</dl><p class="role-example"><strong>На нашем примере</strong><br>'+esc(p.example)+'</p>';
    $('role-dialog').showModal();
  }
  function openDetails(ref){navigate('details',stageIndex,ref||[stage().graph,stage().flow,stage().focus]);}
  function renderDetails(){
    var ref=selectedRef||[stage().graph,stage().flow,stage().focus];
    var route=ref.join('/');if(route!==frameRoute){frameRoute=route;$('expert-frame').src='expert.html#'+route;}
  }
  function applyVideoSeek(){var v=$('presentation-video');if(pendingSeek!==null && v.readyState>=1){v.currentTime=pendingSeek;pendingSeek=null;}}
  function updateVideoChapters(){document.querySelectorAll('[data-video-chapter]').forEach(function(b){b.setAttribute('aria-current',String(Number(b.dataset.videoChapter)===stageIndex));});}

  $('version').textContent='v'+story.version;
  $('video-notice').textContent=story.notice+' Русская озвучка и встроенные титры.';
  $('video-chapters').innerHTML=stages.map(function(s,i){return '<button class="video-chapter" data-video-chapter="'+i+'"><span>'+timeLabel(chapterTime(i))+'</span>'+esc(s.label)+'</button>';}).join('');
  $('transcript').innerHTML=stages.map(function(s){return '<h3>'+esc(s.title)+'</h3><p>'+esc(s.narration)+'</p>';}).join('');
  document.addEventListener('click',function(e){
    if(e.target.closest('.skip-link')){e.preventDefault();$('main-content').focus();return;}
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.mode)navigate(b.dataset.mode,stageIndex);
    else if(b.dataset.stage!==undefined)navigate(mode,Number(b.dataset.stage));
    else if(b.dataset.role!==undefined)openRole(Number(b.dataset.role));
    else if(b.hasAttribute('data-open-presentation'))navigate('presentation',stageIndex);
    else if(b.dataset.videoChapter!==undefined){navigate('presentation',Number(b.dataset.videoChapter));$('presentation-video').play().catch(function(){});}
    else if(b.id==='favorite-button'){favorite=!favorite;renderPhone();$('favorite-button').focus();}
  });
  $('previous').addEventListener('click',function(){navigate(mode,stageIndex-1);});
  $('next').addEventListener('click',function(){navigate(mode,(stageIndex+1)%stages.length);});
  $('simulate').addEventListener('click',simulate);
  $('open-technical').addEventListener('click',function(){openDetails();});
  $('back-to-story').addEventListener('click',function(){navigate('guided',stageIndex);});
  $('close-dialog').addEventListener('click',function(){$('role-dialog').close();});
  $('role-dialog').addEventListener('close',function(){if(lastFocus && lastFocus.isConnected)lastFocus.focus();});
  $('role-dialog').addEventListener('click',function(e){if(e.target===$('role-dialog')){var r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('role-source').addEventListener('click',function(){var ref=currentRole.ref;$('role-dialog').close();openDetails(ref);});
  $('presentation-video').addEventListener('loadedmetadata',applyVideoSeek);
  $('presentation-video').addEventListener('error',function(){$('video-notice').textContent='Не удалось открыть видео. Убедитесь, что папка media находится рядом с сайтом. Текст рассказа доступен ниже.';});
  $('presentation-video').addEventListener('timeupdate',function(){if(mode!=='presentation'||pendingSeek!==null)return;var t=this.currentTime,i=0;videoInfo.chapters.forEach(function(v,n){if(t>=v)i=n;});if(i!==stageIndex){stageIndex=i;updateVideoChapters();try{history.replaceState(null,'',routeHash());}catch(e){/* file browsers may restrict history */}}});
  window.addEventListener('message',function(e){
    if(e.source!==$('expert-frame').contentWindow||mode!=='details'||!e.data||e.data.type!=='mp-graph-route')return;
    var ref=e.data.ref;if(!Array.isArray(ref)||ref.length<2||ref.length>3||ref.some(function(s){return typeof s!=='string'||!/^[a-z0-9-]+$/.test(s);}))return;
    if(['overview','mp-spec','mp-dev'].indexOf(ref[0])<0)return;
    selectedRef=ref;frameRoute=ref.join('/');
    var matches=stages.map(function(s,i){return s.participants.some(function(p){return p.ref[0]===ref[0]&&p.ref[2]===ref[2];})?i:-1;}).filter(function(i){return i>=0;});
    if(matches.length && matches.indexOf(stageIndex)<0)stageIndex=matches[0];
    try{history.replaceState(null,'',routeHash());}catch(err){/* optional URL sync */}
  });
  document.addEventListener('keydown',function(e){
    if(mode==='details'||mode==='presentation'||$('role-dialog').open||e.altKey||e.ctrlKey||e.metaKey||/INPUT|TEXTAREA|SELECT|VIDEO/.test(e.target.tagName))return;
    if(e.key==='ArrowRight'){e.preventDefault();navigate(mode,Math.min(stageIndex+1,stages.length-1));}
    if(e.key==='ArrowLeft'){e.preventDefault();navigate(mode,Math.max(stageIndex-1,0));}
  });
  window.addEventListener('hashchange',readRoute);window.addEventListener('popstate',readRoute);
  readRoute();
})();
