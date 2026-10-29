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

  // 출력(액추에이터) 코드: 저장 시 sensors와 분리 (spec.md 12장)
  const OUTPUT_CODES = ["led", "speaker"];

  /**
   * 설계 그림을 Firebase Storage에 올리고 다운로드 URL을 돌려준다.
   * 실패해도 저장 전체를 막지 않도록 best-effort로 처리한다.
   */
  async function uploadImage(projectId, file) {
    if (!file || !firebase.storage) return [];
    try {
      const ref = firebase.storage().ref(`project-images/${projectId}/${file.name}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      return [url];
    } catch (e) {
      console.warn("이미지 업로드 실패(저장은 계속):", e);
      return [];
    }
  }

  /**
   * 프로젝트를 Firestore 'projects' 컬렉션에 저장한다. (spec.md 12장 구조)
   * @returns {Promise<string>} 생성된 문서 ID
   */
  async function saveProject(state) {
    const ref = db.collection("projects").doc(); // 문서 ID 미리 생성 (Storage 경로용)
    const id = ref.id;

    const imageUrls = await uploadImage(id, state.design.imageFile);

    const chosen = state.design.sensors || [];
    const sensors = chosen.filter((c) => !OUTPUT_CODES.includes(c));
    const outputs = chosen.filter((c) => OUTPUT_CODES.includes(c));

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const payload = {
      owner: state.owner || "익명",
      className: state.className || "",
      currentStep: state.currentStep,
      problem: {
        source: state.problem.padletUrl ? "padlet" : "self",
        padletUrl: state.problem.padletUrl || "",
        growthDiary: state.problem.growthDiary || "",
        candidates: state.problem.candidates || [],
        selected: state.problem.selected || "",
      },
      design: {
        description: state.design.description || "",
        steps: state.design.steps || [],
        sensors: sensors,
        outputs: outputs,
        extraSensors: state.design.extraSensors || [],
        imageUrls: imageUrls,
      },
      makecode: {
        projectUrl: "https://makecode.microbit.org/",
        shareId: "",
        status: "inProgress",
      },
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(payload);
    return id;
  }

  window.saveProject = saveProject;
})();
