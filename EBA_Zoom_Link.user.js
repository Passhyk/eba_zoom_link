// ==UserScript==
// @name         EBA~Zoom Link
// @version      0.3.1
// @namespace    https://ders.eba.gov.tr/
// @description  EBA canlı derslerine Zoom uygulaması üzerinden ulaşın!
// @author       Çağlar Turalı
// @homepageURL  https://github.com/caglarturali/eba_zoom_link/
// @updateURL    https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.meta.js
// @downloadURL  https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.user.js
// @icon         https://github.com/caglarturali/eba_zoom_link/raw/master/assets/logo256.png
// @match        https://ders.eba.gov.tr/ders/*
// @connect      eba.gov.tr
// @grant        GM_xmlhttpRequest
// @noframes
// @run-at       document-start
// ==/UserScript==

// Global object to attach everything into.
const zooom = {};

zooom.CONFIG = { //Required URL's for data exchange.
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
  studentFallback: { // During liveMiddleware, access to the student config URL's is prohibited.
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
  teacher: { // Teacher config is the same as student but the studytime url and the tokentype changes.
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

zooom.init = async function () {
  const panel = zooom.createContainer('div');
  panel.style.backgroundColor = '#3aa1d8';
  panel.style.color = 'black'; // Main link container setup.

  const informText = document.createElement('span');
  informText.innerText = 'Yükleniyor...';
  panel.appendChild(informText); // Status Message Setup.

  document.body.appendChild(panel);

  var isTeacher;

  if (window.location.pathname.indexOf('liveMiddleware') < 0) { // are we in the liveMiddleware ?
    var studyTimeConfig = zooom.CONFIG.teacher.studytime({
      status: 1,
      type: 2,
      pagesize: 25,
      pagenumber: 0,
    });
    var studyTimeData = await zooom.queryServiceForJson(studyTimeConfig); //Get teacher data if accessable.

    if (!zooom.isSuccess(studyTimeData)) { // if the teacher URL is not accessable.
      isTeacher=false; // Can't access to the teacher data, the user is likely a student.
      studyTimeConfig = zooom.CONFIG.student.studytime({
        status: 1,
        type: 2,
        pagesize: 25,
        pagenumber: 0,
      });
      studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);

      if(!zooom.isSuccess(studyTimeData)) { // Last chance for recovery. Try liveMiddleware.
        if(! await zooom.studentFallback(panel,informText,isTeacher)){
          panel.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
          panel.style.color = 'white';
          informText.innerText = 'Ders bilgisi alınamadı. Giriş durumunuzu kontrol ediniz.';
          zooom.print('Unable to load meeting data');
          return false;
        }
        else return true;
      }
    }
    else isTeacher=true; // No errors accured, the user is a teacher.
  }

  else { // the script ran at liveMiddleware page so do studentFallback.
    isTeacher=false; // Can't access to the teacher data (due to if statement above), the user is a student.
    if(! await zooom.studentFallback(panel,informText,isTeacher)){ // But the index is still accessable so more robustness here.
      studyTimeConfig = zooom.CONFIG.student.studytime({
        status: 1,
        type: 2,
        pagesize: 25,
        pagenumber: 0,
      });
      studyTimeData = await zooom.queryServiceForJson(studyTimeConfig);
      if (!zooom.isSuccess(studyTimeData)) { // Can't access to lesson data.
        panel.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
        panel.style.color = 'white';
        informText.innerText = 'Ders bilgisi alınamadı. Giriş durumunuzu kontrol ediniz.';
        zooom.print('Unable to load meeting data');
        return false;
      }
    }
    else return;
  }
  
  if (!(studyTimeData.totalRecords > 0)) { // No meetings are found. Remove panel after 5 seconds.
    informText.innerText = "Planlanmış Canlı Dersiniz Bulunmamakta.";
    setTimeout( () => document.getElementById('hideBtnEbaZoom').remove(), 5000);
    setTimeout( () => panel.remove(),5000);
    return zooom.print('No live lessons found');
  }

  const lessonsList = document.createElement('ul'); // Container for lesson entries.

  panel.style.backgroundColor = 'rgba(92, 184, 92, 0.9)';
  panel.style.color = 'ghostwhite';
  panel.innerHTML = ''; // All went right, change color to green (inform the user the operation was successful) and clear the message for incoming lessons below.

  studyTimeData.studyTimeList.forEach((studyTime) => {
    const { id, title, startdate, enddate, ownerName, ownerSurname } = studyTime;
    const dates = `(${new Date(startdate).toLocaleString()} - ${new Date(enddate).toLocaleString()})`; //The date text, just epoch to readable format conversion.

    const lessonItem = document.createElement('li');
    lessonItem.style.listStyle = 'none';

    const info = zooom.createLiveLessonEntry( // Create a span tag with necessary functions and text setup.
      `${title} ${dates}`,
      `${ownerName} ${ownerSurname}`,
      id,
      zooom.CONFIG.student,
      isTeacher,
      startdate,
    );

    lessonItem.appendChild(info);
    lessonsList.appendChild(lessonItem); // Add the final link to <ul> container.
  });

  panel.appendChild(lessonsList); // Put the <ul> container into Main link container, panel.
};

//
// Helpers.
//

zooom.timeout = (ms, promise) => {
  return new Promise(function(resolve, reject) {
    setTimeout(() => reject(new Error("Timed Out.")) , ms);
    promise.then(resolve, reject);
  });
} // For robustness in queryServiceForJson helper.

zooom.queryServiceForJson = async (config) => {
  const { url, method, headers, body } = config; // Get required parameters from the config.

  let result = {}, inc, response;

  for(inc=0;inc<5;inc++){ // Retries loop.
    try {
      response = await zooom.timeout( 60000, fetch(url, {
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
      })); // Fetch with timeout.
      if (response.status === 200) { // Operation Successful.
        result = await response.json();
        break;
      }
      if (response.status === 403) break; //In case of access restriction, pass retrying.

    } catch (error) {
      if (error instanceof TypeError) { // Sometimes there is a 502 error, this is to catch that.
        zooom.print('Erişim ile ilgili bir hata oluştu Deneme:',inc);
        continue;
      }
      if (error.message == 'Timed Out.'){ // Sometimes request lasts about 35 to 40 seconds. If it goes above specified retry again.
        continue;
      }
      zooom.print(`Error while loading ${url}\n\t${error}`); // Something unexcepted happened.
      break;
    }
  }
  return result;
};

zooom.studentFallback = async (panel,informText,isTeacher) => { // defined as a function, because of multiple uses. To properly running it, arguments are just passed right in.
  zooom.print('Falling Back to getlivelessoninfo.');

  let liveLessonConfig = zooom.CONFIG.studentFallback.studytime();
  let studyTimeData = await zooom.queryServiceForJson(liveLessonConfig); // get lesson data.

  if (!zooom.isSuccess(studyTimeData)) return false; // Can't access to lesson data.
  if (studyTimeData.liveLessonInfo.studyTime == null) return false; // Livemiddleware is not active
  const {
    liveLessonInfo: {
      studyTime: { studyTimeId, studyTimeTitle, ownerName, startDate, endDate },
    },
  } = studyTimeData; // Get required parameters.

  panel.style.backgroundColor = 'rgba(92, 184, 92, 0.9)';
  panel.style.color = 'ghostwhite';
  panel.innerHTML = ''; // same as above, inform the user and clear the links area for incoming lesson.
  const list = document.createElement('ul'); // Links container.
  const item = document.createElement('li'); // studentFallback only returns one lesson so no loop but just one entry.
  item.style.listStyle = 'none';

  const dates = `(${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()})`; // epoch to readable date.
  const info = zooom.createLiveLessonEntry(
    `${studyTimeTitle} ${dates}`,
    `${ownerName}`,
    studyTimeId,
    zooom.CONFIG.studentFallback,
    isTeacher,
    startDate,
  );

  item.appendChild(info); // append span to <li>
  list.appendChild(item); // append <li> to <ul>
  panel.appendChild(list); // append the <ul> container to Main Link Container.

  return true;
}

zooom.createLiveLessonEntry = (text, title, studytimeid, config, isTeacher, startDate) => {
  const entry = zooom.createLink(text, title); // Create a <span> for information.

  // When clicked, (try to) open meeting in a new tab.
  entry.onclick = async () => {
    if (startDate < new Date().getTime()){ // check if the meeting is able to start.
      const liveLessonConfig = config.livelesson({
        studytimeid,
        tokentype: "nonce"
      });
      const liveLessonData = await zooom.queryServiceForJson(liveLessonConfig);

      if (liveLessonData.operationMessage == 'studytimenotstarted'){ // EBA doesn't allow to start meetings before the startTime. (it doesn't give the user token)
        alert('Dersiniz Daha Başlamamış.');
        throw new Error('Ders Başlatılmadı.');
      }
      else if (!zooom.isSuccess(liveLessonData)) { // Can't load start data.
        alert('Ders bilgisini alırken bir hata oluştu, tekrar deneyiniz.');
        return zooom.print('Unable to load start meeting data');
      }

      const {
        meeting: { url, token },
      } = liveLessonData;
      // They messed up the token returning so we changed it. Uses same token distribution as eba_canli_ders.exe
      GM_xmlhttpRequest({
      	method: "GET",
      	url: `https://uygulama-ebaders.eba.gov.tr/FrontEndService/livelesson/nonce/${token}`,
      	headers: {
      		"Accept":"json",
      	},
      	onload: (r) => {
      		unsafeWindow.open(`${url}?tk=${r.responseText.split("|")[0]}`)
      	}
      });
    }
    else{ // meeting is not started.
      alert('Dersiniz Daha Başlamamış.');
    }
  };

  return entry;
};

zooom.jsonToFormData = (jsonObj) => { // Not going to explain, just a json to formdata converter.
  const tokens = [];
  for (const key in jsonObj) {
    const value = jsonObj[key];
    tokens.push(`${key}=${value}`);
  }
  return tokens.join('&');
};

zooom.isSuccess = (data) => { // check there is anything useful in the response.
  return Object.entries(data).length != 0 && data.operationCode == 200 && data.success;
};

zooom.createContainer = (element) => { // The Main Container Helper.
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
  el.style.textAlign = 'center'; // Fancy CSS stuff. Lock to the bottom of the page and some color and text styling.
  if(!window.localStorage.LiveLessonListClosed){ // To remember if the container is closed or not.
    window.localStorage.LiveLessonListClosed = '0';
  }
  el.style.display = window.localStorage.LiveLessonListClosed == '1' ? 'none' : 'block';

  const hideBtn = zooom.createHideButton(window.localStorage.LiveLessonListClosed == '1' ? 'Göster' : 'Gizle'); // the container hide button.
  hideBtn.onclick = function () { // logic to close or open the main container.
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
  document.body.append(hideBtn); // append the button directly to the body.

  return el;
};

zooom.createHideButton = (text) => { // Create The hide button.
  const el = document.createElement('button');
  el.id = 'hideBtnEbaZoom';
  el.innerText = text;
  el.style.cursor = 'pointer';
  el.style.position = 'fixed';
  el.style.bottom = '10px';
  el.style.right = '10px';
  el.style.color = 'black';
  el.style.zIndex = 10001; // css, lock to right bottom, get over everything in the page.
  return el;
};

zooom.createLink = (text, title, element = 'span') => { // Link <span> creator.
  const el = document.createElement(element);
  el.innerText = text;
  el.title = title;
  el.style.cursor = 'pointer';
  el.style.padding = '4px';
  return el;
};

zooom.print = console.log; // To log errors and other stuff.

window.onload = zooom.init; // Run after the page is loaded.


// Just in case..
unsafeWindow.zooom = zooom;
