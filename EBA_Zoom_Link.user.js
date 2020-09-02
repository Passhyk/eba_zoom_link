// ==UserScript==
// @name         EBA~Zoom Link
// @version      0.2.1
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

// Do the processing.
zooom.init = async function () {
  // Get the list of live lessons.
  const studyTimeData = await zooom.queryServiceForJson('/studytime/getstudentstudytime', {
    status: 1,
    type: 2,
    pagesize: 25,
    pagenumber: 0,
  });

  if (!(zooom.isSuccess(studyTimeData) && studyTimeData.totalRecords > 0)) {
    return console.log('No live lessons found.');
  }

  // Container for lesson entries.
  const lessonsList = document.createElement('ul');

  studyTimeData.studyTimeList.forEach((studyTime) => {
    const { id, title, startdate, enddate, ownerName, ownerSurname } = studyTime;
    const dates = `(${new Date(startdate).toLocaleString()} - ${new Date(enddate).toLocaleString()})`;

    const lessonItem = document.createElement('li');
    lessonItem.style.padding = '4px';
    lessonItem.style.listStyle = 'none';

    const info = document.createElement('span');
    info.innerText = `${title} ${dates}`;
    info.style.cursor = 'pointer';
    info.title = `${ownerName} ${ownerSurname}`;

    // When clicked, (try to) open meeting in a new tab.
    info.onclick = async () => {
      const liveLessonData = await zooom.queryServiceForJson('/livelesson/instudytime/start', {
        studytimeid: id,
        tokentype: 'sometokentype',
      });

      if (!zooom.isSuccess(liveLessonData)) {
        return console.log('Error loading meeting data.');
      }

      const {
        meeting: { url, token },
      } = liveLessonData;
      unsafeWindow.open(`${url}?tk=${token}`);
    };

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
zooom.queryServiceForJson = async (endpoint, payload) => {
  const SERVICE_BASE = 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/';

  const response = await fetch(`${SERVICE_BASE}${endpoint}`, {
    headers: {
      accept: 'json',
      'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
    },
    method: 'POST',
    body: zooom.jsonToFormData(payload),
    mode: 'cors',
    credentials: 'include',
  });
  return await response.json();
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
  return data.operationCode == 200 && data.success;
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
  return el;
};

// Wait until Angular is loaded.
zooom.initWatcher = setInterval(function () {
  console.log('Waiting...');
  if (unsafeWindow.angular) {
    clearInterval(zooom.initWatcher);
    zooom.init();
  }
}, 500);

// Just in case..
unsafeWindow.zooom = zooom;
