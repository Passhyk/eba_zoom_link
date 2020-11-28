// ==UserScript==
// @name         EBA~Zoom Link Integrated
// @version      0.0.1
// @namespace    https://ders.eba.gov.tr/
// @description  EBA canlı derslerine Zoom uygulaması üzerinden ulaşın!
// @author       Çağlar Turalı,bytescreator
// @homepageURL  https://github.com/caglarturali/eba_zoom_link/
// @updateURL    https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link.meta.js
// @downloadURL  https://github.com/caglarturali/eba_zoom_link/raw/master/EBA_Zoom_Link_Integrated.user.js
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
  getUserInfo: { // To get user role.
    base: 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/',
    getfulluserinfo(payload) {
      return {
        url: `${this.base}/home/user/getuserinfo`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: zooom.jsonToFormData(payload),
      };
    },
  },
  student: {
    base: 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/',
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
  teacher: { // Teacher config is the same as student but the studytime url changes.
    base: 'https://uygulama-ebaders.eba.gov.tr/ders/FrontEndService/',
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
zooom.init = async () => {
  const userConfig = zooom.CONFIG.getUserInfo.getfulluserinfo({ 
    'operation': 'getuserinfo',
    'cacheservervalid': false,
  });
  const userData = await zooom.queryServiceForJson(userConfig); // Query full user info (just going to use userrole.)
  let isTeacher;
  if(!zooom.isSuccess(userData)){
    if(!window.location.toString().includes('liveMiddleware')){
      alert('Kullanıcı Tipi Belirlenemedi.');
      return;
    }
    else{
      isTeacher = false;
    }
  }else {
    const {userInfoData : {role} } = userData;
    isTeacher = role == 3 ? false : true; // the student role is 3, otherwise the user is probably a teacher.
  }
  console.log(isTeacher)
  console.log(setInterval(() => zooom.linkInserter(isTeacher), 1000)); // Constantly checks for the window.location ()
};
zooom.linkInserter = (isTeacher) => {
  if(window.location.toString().includes("/main/etudDetail")){
    const insertionDiv = document.getElementsByClassName('p-l-xs vc-display-flex vc-align-items-center m-t-sm ng-scope')[0];
    if(!insertionDiv) return;
    if(insertionDiv.children.length > 1) return;
    const linkDiv = document.createElement('div');
    linkDiv.className = insertionDiv.children[0].className;
    linkDiv.style.backgroundColor = "#438afc";
    linkDiv.style.color = 'white';
    linkDiv.style.marginLeft='10px';
    linkDiv.innerHTML = "Eba~Zoom Link İle Başlat";
    linkDiv.addEventListener('click', () => {
      const locationHash = window.location.hash.split("?")[1].split("&");
      for(var i=0; i < locationHash.length; i++){
        if(locationHash[i].startsWith('id')){
          break;
        }
      }
      const studytimeid = locationHash[i].substr(3);
      if(!studytimeid) return;
      zooom.startMeeting(studytimeid, isTeacher ? zooom.CONFIG.teacher : zooom.CONFIG.student, 0);
    });
    insertionDiv.append(linkDiv);
  }
  if(window.location.toString().includes('liveMiddleware')){
    if(document.getElementById('ebazoomlinkinsertion')) return;
    const insertionDiv = document.getElementById('joinMeeting').parentElement;
    const standartJoinButton = document.getElementById('joinMeeting');
    const link = document.createElement('h4');
    link.innerHTML = "Eba~Zoom Link İle Katıl";
    link.style.backgroundColor = "#438afc";
    link.style.color = 'white';
    link.id = 'ebazoomlinkinsertion';
    link.className = standartJoinButton.className;
    link.addEventListener('click', async () => {
      const queryData = await zooom.queryServiceForJson(zooom.CONFIG.studentFallback.studytime());
      const { liveLessonInfo: {
          studyTime: { studyTimeId, startDate },
        },
      } = queryData;
      zooom.startMeeting(studyTimeId, zooom.CONFIG.studentFallback, false, startDate);
    });
    insertionDiv.append(link);
  }
};

//Helpers...

zooom.startMeeting = async (studytimeid, config, isTeacher, startDate) => { // The Last Function to start the meeting.
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
    // Detail in Github Wiki and https://github.com/sh4dowb/eba-canli-ders-crossplatform/issues/5
    GM_xmlhttpRequest({
      method: "GET",
      url: `https://uygulama-ebaders.eba.gov.tr/FrontEndService/livelesson/nonce/${token}`,
      headers: {
          "Accept":"json",
      },
      onload: (r) => {
        unsafeWindow.open(`${url}?${isTeacher ? 'zak' : 'tk'}=${r.responseText.replaceAll('"',"").split("|")[isTeacher ? 6:0]}`)
      }
    });
  }
  else{ // meeting is not started.
    alert('Dersiniz Daha Başlamamış.');
  }
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

unsafeWindow.onload = zooom.init;