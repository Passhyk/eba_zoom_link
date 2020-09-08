// ==UserScript==
// @name         EBA~Zoom Link
// @version      0.2.4
// @namespace    https://ders.eba.gov.tr/
// @description  EBA canlı derslerine Zoom uygulaması üzerinden ulaşın!
// @author       Çağlar Turalı
// @homepageURL  https://github.com/caglarturali/eba_zoom_link/
// @updateURL    https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.meta.js
// @downloadURL  https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.user.js
// @icon         https://github.com/caglarturali/eba_zoom_link/raw/master/assets/logo256.png
// @match        http*://ders.eba.gov.tr/*
// @connect      eba.gov.tr
// @grant        GM_xmlhttpRequest
// @run-at       document-end
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
    livelesson(payload){
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
    studytime(payload){
      return {
        url: `${this.base}/studytime/getteacherstudytime`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
    livelesson(payload){
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
  // Get the list of live lessons.
  // The POST body is not so important (I think...)
  var studyTimeConfig = zooom.CONFIG.teacher.studytime({
    status: 1,
    type: 2,
    pagesize: 25,
    pagenumber: 0,
  });
  var studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);
  if(!zooom.isSuccess(studyTimeData)){
    studyTimeConfig = zooom.CONFIG.student.studytime({
      status: 1,
      type: 2,
      pagesize: 25,
      pagenumber: 0,
    });
    studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);
  }
  console.info(studyTimeConfig);
  if (!zooom.isSuccess(studyTimeData)) {
    zooom.print('Unable to load study time data. Falling Back to getlivelessoninfo.');

    const liveLessonConfig = zooom.CONFIG.studentFallback.studytime();
    const StudyTimeData = await zooom.queryServiceForJson(liveLessonConfig);

    if (!zooom.isSuccess(StudyTimeData)) {
      return zooom.print('Unable to load meeting data');
    }

    const {
      liveLessonInfo: { studyTime : {studyTimeId, studyTimeTitle, ownerName, startDate, endDate} }
    } = StudyTimeData;

    const panel = zooom.createContainer('div');
    const list = document.createElement('ul');
    const item = document.createElement('li');
    item.style.listStyle = 'none';

    const dates = `(${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()})`;
    const info = zooom.createStudentLessonEntry(`${studyTimeTitle} ${dates}`, `${ownerName}`, studyTimeId,zooom.CONFIG.studentFallback);

    item.appendChild(info);
    list.appendChild(item);
    panel.appendChild(list);
    document.body.appendChild(panel);

    return;
  }

  if (!(studyTimeData.totalRecords > 0)) {
    return zooom.print('No live lessons found');
  }

  // Container for lesson entries.
  const lessonsList = document.createElement('ul');

  studyTimeData.studyTimeList.forEach((studyTime) => {
    const { id, title, startdate, enddate, ownerName, ownerSurname } = studyTime;
    const dates = `(${new Date(startdate).toLocaleString()} - ${new Date(enddate).toLocaleString()})`;

    const lessonItem = document.createElement('li');
    lessonItem.style.listStyle = 'none';

    const info = zooom.createStudentLessonEntry(`${title} ${dates}`, `${ownerName} ${ownerSurname}`, id,zooom.CONFIG.student);

    lessonItem.appendChild(info);
    lessonsList.appendChild(lessonItem);
  });

  // The magic happens here.
  const panel = zooom.createContainer('div');
  panel.appendChild(lessonsList);
  document.body.appendChild(panel);
};

//
// Helpers.
//
zooom.queryServiceForJson = async (config) => {
  const { url, method, headers, body } = config;

  let result = {};

  try {
    const response = await fetch(url, {
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
    });
    if (response.status === 200) {
      result = await response.json();
    }
  } catch (error) {
    zooom.print(`Error while loading ${url}\n\t${error}`);
  } finally {
    return result;
  }
};

zooom.createStudentLessonEntry = (text, title, studytimeid,config) => {
  const entry = zooom.createLink(text, title);

  // When clicked, (try to) open meeting in a new tab.
  entry.onclick = async () => {
    const liveLessonConfig = config.livelesson({
      studytimeid,
      tokentype: 'sometokentype',
    });
    const liveLessonData = await zooom.queryServiceForJson(liveLessonConfig);

    if (!zooom.isSuccess(liveLessonData)) {
      return zooom.print('Unable to load meeting data');
    }

    const {
      meeting: { url, token },
    } = liveLessonData;
    unsafeWindow.open(`${url}?tk=${token}`);
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
  el.style.display = 'block';

  const hideBtn = zooom.createHideButton('Gizle');
  hideBtn.onclick = function () {
    if (el.style.display == 'none') {
      el.style.display = 'block';
      hideBtn.innerText = 'Gizle';
    } else {
      el.style.display = 'none';
      hideBtn.innerText = 'Göster';
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

zooom.print = console.log;

// Wait until Angular is loaded.
/*zooom.initWatcher = setInterval(function () {
  zooom.print('Waiting...');
  if (unsafeWindow.angular) {
    clearInterval(zooom.initWatcher);
    zooom.init();
  }
}, 500);*/ //Doesn't work on LiveMiddleWare
window.onload=zooom.init;

// Just in case..
unsafeWindow.zooom = zooom;
