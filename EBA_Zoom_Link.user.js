// ==UserScript==
// @name         EBA~Zoom Link
// @version      0.2.3
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
  studentFallback:{
    base: 'https://ders.eba.gov.tr/',
    livelesson() {
      return {
        url: `${this.base}/getlivelessoninfo`,
        method: 'GET',
      }
    }
  },
  teacher: {
    base: 'https://ders.eba.gov.tr/ders',
    livelesson() {
      return {
        url: `${this.base}/getlivelessoninfo`,
        method: 'GET',
      };
    },
  },
};

// Do the processing.
zooom.init = async function () {
  // Get the list of live lessons.
  const studyTimeConfig = zooom.CONFIG.student.studytime({
    status: 1,
    type: 2,
    pagesize: 25,
    pagenumber: 0,
  });
  const studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);

  if (!zooom.isSuccess(studyTimeData)) {
    zooom.print('Unable to load study time data. Falling Back to getlivelessoninfo.');
    const liveLessonData = await zooom.queryServiceForJson(zooom.CONFIG.studentFallback.livelesson());
    if (!zooom.isSuccess(liveLessonData)) {
      return zooom.print('Unable to load meeting data');
    }
    var m=liveLessonData.json();
    unsafeWindow.open(m.liveLessonInfo.meetingJoinUrl+"?pwd="+m.liveLessonInfo.meetingPassword);
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

    const info = zooom.createLink(`${title} ${dates}`, `${ownerName} ${ownerSurname}`);

    // When clicked, (try to) open meeting in a new tab.
    info.onclick = async () => {
      const liveLessonConfig = zooom.CONFIG.student.livelesson({
        studytimeid: id,
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
  const { url, method, headers, body = undefined } = config;

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
    if(el.style.display == 'none') { 
      el.style.display = 'block';
      hideBtn.innerText = 'Gizle';
    }
    else {
      el.style.display = 'none';
      hideBtn.innerText = 'Göster';
    }
  };
  document.body.append(hideBtn);

  return el;
};
zooom.createHideButton = (text) => {
  const el = document.createElement("button")
  el.innerText = text;
  el.style.cursor = 'pointer';
  el.style.position = "fixed";
  el.style.bottom = "10px";
  el.style.right = "10px";
  el.style.color = "black";
  el.style.zIndex = 10001;
  return el;
}

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
zooom.initWatcher = setInterval(function () {
  zooom.print('Waiting...');
  if (unsafeWindow.angular) {
    clearInterval(zooom.initWatcher);
    zooom.init();
  }
}, 500);

// Just in case..
unsafeWindow.zooom = zooom;
