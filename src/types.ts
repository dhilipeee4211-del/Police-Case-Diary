export interface Accused {
  sNo: string;
  nameAndAddress: string;
}

export interface CaseDiary {
  id: string; // generated client-side or server-side (e.g. index-based)
  policeStation: string;
  district: string;
  crNoAndSecOfLaw: string;
  dateTimeAndPlaceOfOccurrence: string;
  dateOfCd: string;
  dateOfReportTime: string;
  complainant: string;
  accusedList: Accused[];
  propertyLostDetails: string;
  recoveredPropertyDetails: string;
  dateOfPreviousCaseDiary: string;
  stageOfTheCase: string;
  courtRefNo: string;
  hearingNo: string;
  courtNameAndPlace: string;
  whetherMagistratePresent: string; // 'YES' / 'NO'
  whetherAppPpPresent: string; // 'YES' / 'NO'
  whetherDefenceCounselPresent: string; // 'YES' / 'NO'
  noOfPwsCited: string;
  noOfPwsExaminedSoFar: string;
  noOfPwsExaminedToday: string;
  totalNoOfAccusedCharged: string;
  totalNoOfAccusedPresent: string; // NEW: matches reference doc's "TOTAL NO. OF ACCUSED PRESENT"
  noOfAccusedPresent: string;
  noOfAccusedAbsent: string;
  remarks: string; // Full text including English/Tamil transcriptions/summaries
  postedFor: string;
  nextHearingDate: string;
  attendedBy: string;
  isSavedDraft?: boolean;
}

export interface SavedDatabase {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  diaries: CaseDiary[];
}