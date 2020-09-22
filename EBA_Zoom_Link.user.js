// ==UserScript==
// @name         EBA~Zoom Link
// @version      0.2.8
// @namespace    https://ders.eba.gov.tr/
// @description  EBA canlı derslerine Zoom uygulaması üzerinden ulaşın!
// @author       Çağlar Turalı
// @homepageURL  https://github.com/caglarturali/eba_zoom_link/
// @updateURL    https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.meta.js
// @downloadURL  https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.user.js
// @icon         https://github.com/caglarturali/eba_zoom_link/raw/master/assets/logo256.png
// @match        https://ders.eba.gov.tr/*
// @connect      eba.gov.tr
// @grant        GM_xmlhttpRequest
// @noframes
// @run-at       document-start
// ==/UserScript==

// Global object to attach everything into.
const zooom = {};

zooom.CONFIG = {
  student: {
    base: 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/',
    studytime(payload) {
      return {
        url: `${this.base}/studytime/getstudentstudytime`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
    livelesson(payload) {
      return {
        url: `${this.base}/livelesson/instudytime/start`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
  },
  studentFallback: {
    base: 'https://ders.eba.gov.tr/ders',
    appBase: 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/',
    studytime() {
      return {
        url: `${this.base}/getlivelessoninfo`,
        method: 'GET',
      };
    },
    livelesson(payload) {
      return {
        url: `${this.appBase}/livelesson/inpage/instudytime/start`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
  },
  teacher: {
    base: 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/',
    studytime(payload) {
      return {
        url: `${this.base}/studytime/getteacherstudytime`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
    livelesson(payload) {
      return {
        url: `${this.base}/livelesson/instudytime/start`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
  },
};

// Do the processing.
zooom.init = async function () {
  const panel = zooom.createContainer('div');
  panel.style.backgroundColor = '#3aa1d8';
  panel.style.color = 'black';
  let informText=document.createElement('span');
  informText.innerText = 'Yükleniyor...';
  panel.appendChild(informText);
  document.body.appendChild(panel);
  var isTeacher;
  var studyTimeConfig = zooom.CONFIG.teacher.studytime({
    status: 1,
    type: 2,
    pagesize: 25,
    pagenumber: 0,
  });
  var studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);
  if (!zooom.isSuccess(studyTimeData)) {
    studyTimeConfig = zooom.CONFIG.student.studytime({
      status: 1,
      type: 2,
      pagesize: 25,
      pagenumber: 0,
    });
    studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);
    isTeacher=false;
  }
  else{
    isTeacher=true;
  }

  if (!zooom.isSuccess(studyTimeData)) {
    zooom.print('Unable to load study time data. Falling Back to getlivelessoninfo.');

    const liveLessonConfig = zooom.CONFIG.studentFallback.studytime();
    const studyTimeData = await zooom.queryServiceForJson(liveLessonConfig);

    if (!zooom.isSuccess(studyTimeData)) {
      panel.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
      panel.style.color = 'white';
      informText.innerText = 'Ders bilgisi alınamadı. Sayfayı yenileyiniz.';
      return zooom.print('Unable to load meeting data');
    }

    const {
      liveLessonInfo: {
        studyTime: { studyTimeId, studyTimeTitle, ownerName, startDate, endDate },
      },
    } = studyTimeData;

    panel.style.backgroundColor = 'rgba(92, 184, 92, 0.9)';
    panel.style.color = 'ghostwhite';
    panel.innerHTML = '';
    const list = document.createElement('ul');
    const item = document.createElement('li');
    item.style.listStyle = 'none';

    const dates = `(${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()})`;
    const info = zooom.createLiveLessonEntry(
      `${studyTimeTitle} ${dates}`,
      `${ownerName}`,
      studyTimeId,
      zooom.CONFIG.studentFallback,
      isTeacher,
      startDate,
    );

    item.appendChild(info);
    list.appendChild(item);
    panel.appendChild(list);

    return;
  }

  if (!(studyTimeData.totalRecords > 0)) {
    informText.innerText = "Planlanmış Canlı Dersiniz Bulunmamakta.";
    setTimeout( () => panel.remove(),5000);
    return zooom.print('No live lessons found');
  }

  // Container for lesson entries.
  const lessonsList = document.createElement('ul');

  panel.style.backgroundColor = 'rgba(92, 184, 92, 0.9)';
  panel.style.color = 'ghostwhite';
  panel.innerHTML = '';

  studyTimeData.studyTimeList.forEach((studyTime) => {
    const { id, title, startdate, enddate, ownerName, ownerSurname } = studyTime;
    const dates = `(${new Date(startdate).toLocaleString()} - ${new Date(enddate).toLocaleString()})`;

    const lessonItem = document.createElement('li');
    lessonItem.style.listStyle = 'none';

    const info = zooom.createLiveLessonEntry(
      `${title} ${dates}`,
      `${ownerName} ${ownerSurname}`,
      id,
      zooom.CONFIG.student,
      isTeacher,
      startdate,
    );

    lessonItem.appendChild(info);
    lessonsList.appendChild(lessonItem);
  });

  // The magic happens here.
  panel.appendChild(lessonsList);
};

//
// Helpers.
//

zooom.timeout = (ms, promise) => {
  return new Promise(function(resolve, reject) {
    setTimeout(() => reject(new Error("Timed Out.")) , ms);
    promise.then(resolve, reject);
  });
}

zooom.queryServiceForJson = async (config) => {
  const { url, method, headers, body } = config;

  let result = {}, inc, response;
  
  for(inc=0;inc<5;inc++){
    try {
      response = await zooom.timeout(16000, fetch(url, {
        method,
        body,
        headers: {
          accept: 'json',
          'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'content-type': 'application/x-www-form-urlencoded',
          ...headers,
        },
        mode: 'cors',
        credentials: 'include',
      }));
      if (response.status === 200) {
        result = await response.json();
        break;
      }
    } catch (error) {
      if (result.status > 500) {
        zooom.print('Erişim ile ilgili bir hata oluştu Deneme:',inc);
        continue;
      }
      zooom.print(`Error while loading ${url}\n\t${error}`);
    }
  }
  return result;
};

zooom.createLiveLessonEntry = (text, title, studytimeid, config, isTeacher, startDate) => {
  const entry = zooom.createLink(text, title);

  // When clicked, (try to) open meeting in a new tab.
  entry.onclick = async () => {
    if (startDate < new Date().getTime()){
      const liveLessonConfig = config.livelesson({
        studytimeid,
        tokentype: isTeacher ? 'zak' : 'sometokentype',
      });
      const liveLessonData = await zooom.queryServiceForJson(liveLessonConfig);

      if (liveLessonData.operationMessage == 'studytimenotstarted'){
        alert('Dersiniz Daha Başlamamış.');
        throw new Error('Ders Başlatılmadı.');
      }
      else if (!zooom.isSuccess(liveLessonData)) {
        return zooom.print('Unable to load meeting data');
      }

      const {
        meeting: { url, token },
      } = liveLessonData;
      unsafeWindow.open(isTeacher ? `${url}?zak=${token}` : `${url}?tk=${token}`);
    }
    else{
      alert('Dersiniz Daha Başlamamış.');
    }
  };

  return entry;
};

zooom.jsonToFormData = (jsonObj) => {
  const tokens = [];
  for (const key in jsonObj) {
    const value = jsonObj[key];
    tokens.push(`${key}=${value}`);
  }
  return tokens.join('&');
};

zooom.isSuccess = (data) => {
  return data != {} && data.operationCode == 200 && data.success;
};

zooom.createContainer = (element) => {
  const el = document.createElement(element);
  el.style.backgroundColor = 'rgba(92, 184, 92, 0.9)';
  el.style.color = 'ghostwhite';
  el.style.height = '100px';
  el.style.width = '100vw';
  el.style.overflowY = 'auto';
  el.style.position = 'fixed';
  el.style.bottom = 0;
  el.style.zIndex = 10000;
  el.style.padding = '10px';
  el.style.textAlign = 'center';
  if(!window.localStorage.LiveLessonListClosed){
    window.localStorage.LiveLessonListClosed = '0';
  }
  el.style.display = window.localStorage.LiveLessonListClosed == '1' ? 'none' : 'block';

  const hideBtn = zooom.createHideButton(window.localStorage.LiveLessonListClosed == '1' ? 'Göster' : 'Gizle');
  hideBtn.onclick = function () {
    if (el.style.display == 'none') {
      el.style.display = 'block';
      hideBtn.innerText = 'Gizle';
      window.localStorage.LiveLessonListClosed = '0';
    } else {
      el.style.display = 'none';
      hideBtn.innerText = 'Göster';
      window.localStorage.LiveLessonListClosed = '1';
    }
  };
  document.body.append(hideBtn);

  return el;
};

zooom.createHideButton = (text) => {
  const el = document.createElement('button');
  el.innerText = text;
  el.style.cursor = 'pointer';
  el.style.position = 'fixed';
  el.style.bottom = '10px';
  el.style.right = '10px';
  el.style.color = 'black';
  el.style.zIndex = 10001;
  return el;
};

zooom.createLink = (text, title, element = 'span') => {
  const el = document.createElement(element);
  el.innerText = text;
  el.title = title;
  el.style.cursor = 'pointer';
  el.style.padding = '4px';
  return el;
};

zooom.print = console.log; //Doesn't work on LiveMiddleWare

// Wait until Angular is loaded.
/*zooom.initWatcher = setInterval(function () {
  zooom.print('Waiting...');
  if (unsafeWindow.angular) {
    clearInterval(zooom.initWatcher);
    zooom.init();
  }
}, 500); window.onload =
  zooom.init; */
zooom.init()
// Just in case..
unsafeWindow.zooom = zooom;
