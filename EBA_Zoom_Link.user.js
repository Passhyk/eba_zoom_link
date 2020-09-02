// ==UserScript==
// @name         EBA~Zoom Link
// @version      0.2.0
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
zooom.SERVICE_BASE = 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/';

// Do the processing.
zooom.init = async function () {
  // Get the list of live lessons.
  const studyTimeResp = await fetch(`${zooom.SERVICE_BASE}/studytime/getstudentstudytime`, {
    credentials: 'include',
  });
  const studyTimeData = await studyTimeResp.json();

  if (!(zooom.isSuccess(studyTimeData) && studyTimeData.totalRecords > 0)) {
    return console.log('No live lessons found.');
  }

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
    info.onclick = async () => {
      const liveLessonResp = await fetch(`${zooom.SERVICE_BASE}/livelesson/instudytime/start`, {
        method: 'POST',
        headers: {
          accept: 'json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: `studytimeid=${id}&tokentype=sometokentype`,
        credentials: 'include',
        mode: 'cors',
      });
      const liveLessonData = await liveLessonResp.json();

      if (!zooom.isSuccess(liveLessonData)) {
        return console.log('Error loading meeting data.');
      }

      // Open meeting in a new tab.
      const {
        meeting: { url, token },
      } = liveLessonData;
      unsafeWindow.open(`${url}?tk=${token}`);
    };

    lessonItem.appendChild(info);
    lessonsList.appendChild(lessonItem);
  });

  const panel = zooom.createContainer('div');
  panel.appendChild(lessonsList);

  document.body.appendChild(panel);
};

// Helpers.
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
  console.log('Watching...');
  if (unsafeWindow.angular) {
    clearInterval(zooom.initWatcher);
    zooom.init();
  }
}, 500);

// Just in case..
unsafeWindow.zooom = zooom;
