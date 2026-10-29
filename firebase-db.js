// =====================================================================
// 태스크 3: Firebase Firestore 저장 모듈
// 학생이 작성한 프로젝트(문제·설계·메이크코드)를 Firestore에 저장한다.
// 데이터 구조는 spec.md 12장을 따른다.
// =====================================================================
(function () {
  if (!window.firebase || !window.FIREBASE_CONFIG) {
    console.warn("Firebase SDK 또는 설정이 없어 저장 기능을 사용할 수 없습니다.");
    return;
  }

  firebase.initializeApp(window.FIREBASE_CONFIG);
  const db = firebase.firestore();

  /**
   * 프로젝트를 Firestore 'projects' 컬렉션에 저장한다.
   * @returns {Promise<string>} 생성된 문서 ID
   */
  async function saveProject(state) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const payload = {
      owner: state.owner || "익명",
      currentStep: state.currentStep,
      problem: {
        padletUrl: state.problem.padletUrl || "",
        growthDiary: state.problem.growthDiary || "",
        candidates: state.problem.candidates || [],
        selected: state.problem.selected || "",
      },
      design: {
        steps: state.design.steps || [],
        sensors: state.design.sensors || [],
        extraSensors: state.design.extraSensors || [],
        imageName: state.design.imageName || "",
      },
      makecode: {
        projectUrl: "https://makecode.microbit.org/",
        status: "inProgress",
      },
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection("projects").add(payload);
    return ref.id;
  }

  window.saveProject = saveProject;
})();
