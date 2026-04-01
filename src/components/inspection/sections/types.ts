import type { SectionPhoto } from "@/components/inspection/SectionPhotoUpload";

export const PHOTO_CATEGORIES = [
  { key: "exterior_front", label: "الواجهة الأمامية", group: "exterior", required: true },
  { key: "exterior_back", label: "الواجهة الخلفية", group: "exterior", required: true },
  { key: "exterior_left", label: "الواجهة اليسرى", group: "exterior", required: true },
  { key: "exterior_right", label: "الواجهة اليمنى", group: "exterior", required: true },
  { key: "street_view", label: "منظر الشارع", group: "exterior", required: true },
  { key: "interior_living", label: "صالة المعيشة", group: "interior", required: false },
  { key: "interior_kitchen", label: "المطبخ", group: "interior", required: false },
  { key: "interior_bathroom", label: "دورة المياه", group: "interior", required: false },
  { key: "interior_bedroom", label: "غرفة النوم", group: "interior", required: false },
  { key: "surroundings", label: "المحيط العام", group: "exterior", required: true },
  { key: "site_plan", label: "المخطط / الكروكي", group: "plan", required: false },
  { key: "floor_plan", label: "مخطط الأدوار", group: "plan", required: false },
  { key: "deed_photo", label: "صورة الصك", group: "plan", required: false },
  { key: "problem_cracks", label: "تشققات / عيوب", group: "problems", required: false },
  { key: "problem_moisture", label: "رطوبة / تسربات", group: "problems", required: false },
  { key: "problem_other", label: "مشاكل أخرى", group: "problems", required: false },
  { key: "other", label: "صور إضافية", group: "other", required: false },
];

export const DEFAULT_CHECKLIST = [
  { category: "structure", label_ar: "الهيكل الإنشائي سليم", is_required: true },
  { category: "structure", label_ar: "لا توجد تشققات ظاهرة", is_required: true },
  { category: "structure", label_ar: "حالة السقف جيدة", is_required: true },
  { category: "utilities", label_ar: "توصيلات الكهرباء متوفرة", is_required: true },
  { category: "utilities", label_ar: "توصيلات المياه متوفرة", is_required: true },
  { category: "utilities", label_ar: "نظام الصرف الصحي يعمل", is_required: true },
  { category: "exterior", label_ar: "حالة الأسوار والبوابات", is_required: false },
  { category: "exterior", label_ar: "المواقف متوفرة", is_required: false },
  { category: "exterior", label_ar: "التشجير والمسطحات الخضراء", is_required: false },
  { category: "interior", label_ar: "حالة الأرضيات", is_required: true },
  { category: "interior", label_ar: "حالة الدهانات والجدران", is_required: true },
  { category: "interior", label_ar: "حالة النوافذ والأبواب", is_required: true },
  { category: "compliance", label_ar: "مطابقة للمخطط المعتمد", is_required: true },
  { category: "compliance", label_ar: "لا توجد مخالفات بناء", is_required: true },
];

export interface PhotoItem {
  category: string;
  file_name: string;
  preview: string;
  description: string;
  file?: File;
}

export interface ChecklistItem {
  category: string;
  label_ar: string;
  is_checked: boolean;
  is_required: boolean;
}

export interface FormData {
  request_number: string;
  inspection_date: string;
  inspector_name: string;
  asset_type: string;
  deed_number: string;
  city: string;
  district: string;
  street: string;
  building_number: string;
  valuation_purpose: string;
  assignment_ref: string;
  valuer_name: string;
  inspection_time: string;
  detailed_address: string;
  district_type: string;
  district_level: string;
  nearby_mosque: string;
  nearby_mosque_distance: string;
  nearby_school: string;
  nearby_school_distance: string;
  nearby_hospital: string;
  nearby_hospital_distance: string;
  nearby_mall: string;
  nearby_mall_distance: string;
  nearby_highway: string;
  nearby_highway_distance: string;
  gps_lat: number | null;
  gps_lng: number | null;
  access_ease: string;
  surrounding_positives: string;
  surrounding_negatives: string;
  location_confidential_notes: string;
  matches_documents: string;
  asset_description: string;
  current_use: string;
  highest_best_use: string;
  total_area: string;
  front_north_length: string;
  front_north_desc: string;
  front_north_boundary: string;
  front_north_plate: string;
  front_south_length: string;
  front_south_desc: string;
  front_south_boundary: string;
  front_south_plate: string;
  front_east_length: string;
  front_east_desc: string;
  front_east_boundary: string;
  front_east_plate: string;
  front_west_length: string;
  front_west_desc: string;
  front_west_boundary: string;
  front_west_plate: string;
  area_matches_deed: string;
  land_area: string;
  building_area: string;
  num_floors: string;
  dimensions_notes: string;
  exterior_building_age: string;
  exterior_num_floors: string;
  exterior_structure_type: string;
  exterior_facade_finishing: string;
  exterior_facade_material: string;
  exterior_facade_condition: string;
  exterior_paint_condition: string;
  exterior_windows_type: string;
  exterior_windows_condition: string;
  exterior_doors_type: string;
  exterior_doors_condition: string;
  exterior_roof_type: string;
  exterior_roof_condition: string;
  exterior_roof_insulation: string;
  exterior_roof_leaks: string;
  exterior_fence_type: string;
  exterior_fence_condition: string;
  exterior_parking: string;
  exterior_parking_count: string;
  exterior_parking_condition: string;
  exterior_main_entrance_type: string;
  exterior_main_entrance_condition: string;
  exterior_landscaping: string;
  exterior_entrance_count: string;
  exterior_notes: string;
  interior_floors_type: string;
  interior_floors_condition: string;
  interior_walls_type: string;
  interior_walls_condition: string;
  interior_ceilings_type: string;
  interior_ceilings_condition: string;
  interior_kitchen_type: string;
  interior_kitchen_condition: string;
  interior_bathrooms_count: string;
  interior_bathrooms_condition: string;
  interior_doors_type: string;
  interior_doors_condition: string;
  interior_windows_type: string;
  interior_windows_condition: string;
  interior_stairs_type: string;
  interior_stairs_condition: string;
  interior_ac_type: string;
  interior_ac_condition: string;
  interior_electrical_condition: string;
  interior_plumbing_condition: string;
  interior_rooms_count: string;
  interior_halls_count: string;
  interior_bathrooms_count_num: string;
  interior_kitchens_count: string;
  interior_overall_finishing: string;
  interior_notes: string;
  overall_condition: string;
  asset_age: string;
  finishing_level: string;
  condition_notes: string;
  maintenance_rating: string;
  cracks_severity: string;
  moisture_severity: string;
  corrosion_severity: string;
  fire_damage_severity: string;
  structural_damage_severity: string;
  damage_details: string;
  electricity_status: string;
  electricity_condition: string;
  water_source: string;
  water_condition: string;
  sewage_type: string;
  sewage_condition: string;
  roads_paved: boolean;
  gas_status: string;
  internet_status: string;
  central_ac_status: string;
  elevator_status: string;
  elevator_count: string;
  utilities_notes: string;
  utilities_confidential_notes: string;
  total_building_area: string;
  floor_areas: string;
  floor_count_detail: string;
  layout_notes: string;
  garden_area: string;
  parking_area: string;
  annex_area: string;
  area_matches_license: string;
  positive_factors: Record<string, string>;
  positive_factors_other: string;
  negative_factors: Record<string, string>;
  negative_factors_other: string;
  environmental_factors: string;
  regulatory_factors: string;
  inspector_observations: string;
  inspector_recommendations: string;
  additional_notes: string;
  inspector_verdict: string;
  inspector_verdict_notes: string;
  has_risks: string;
  risk_details: string;
  data_complete: string;
  inspector_final_notes: string;
  confidential_notes: string;
  approval_inspector_name: string;
  approval_date: string;
}

export const defaultFormData: FormData = {
  request_number: `INS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  inspection_date: new Date().toISOString().split("T")[0],
  inspector_name: "",
  asset_type: "",
  deed_number: "",
  city: "",
  district: "",
  street: "",
  building_number: "",
  valuation_purpose: "",
  assignment_ref: "",
  valuer_name: "",
  inspection_time: new Date().toTimeString().slice(0, 5),
  detailed_address: "",
  district_type: "",
  district_level: "",
  nearby_mosque: "",
  nearby_mosque_distance: "",
  nearby_school: "",
  nearby_school_distance: "",
  nearby_hospital: "",
  nearby_hospital_distance: "",
  nearby_mall: "",
  nearby_mall_distance: "",
  nearby_highway: "",
  nearby_highway_distance: "",
  gps_lat: null,
  gps_lng: null,
  access_ease: "",
  surrounding_positives: "",
  surrounding_negatives: "",
  location_confidential_notes: "",
  matches_documents: "",
  asset_description: "",
  current_use: "",
  highest_best_use: "",
  total_area: "",
  front_north_length: "",
  front_north_desc: "",
  front_north_boundary: "",
  front_north_plate: "",
  front_south_length: "",
  front_south_desc: "",
  front_south_boundary: "",
  front_south_plate: "",
  front_east_length: "",
  front_east_desc: "",
  front_east_boundary: "",
  front_east_plate: "",
  front_west_length: "",
  front_west_desc: "",
  front_west_boundary: "",
  front_west_plate: "",
  area_matches_deed: "",
  land_area: "",
  building_area: "",
  num_floors: "",
  dimensions_notes: "",
  exterior_building_age: "",
  exterior_num_floors: "",
  exterior_structure_type: "",
  exterior_facade_finishing: "",
  exterior_facade_material: "",
  exterior_facade_condition: "",
  exterior_paint_condition: "",
  exterior_windows_type: "",
  exterior_windows_condition: "",
  exterior_doors_type: "",
  exterior_doors_condition: "",
  exterior_roof_type: "",
  exterior_roof_condition: "",
  exterior_roof_insulation: "",
  exterior_roof_leaks: "",
  exterior_fence_type: "",
  exterior_fence_condition: "",
  exterior_parking: "",
  exterior_parking_count: "",
  exterior_parking_condition: "",
  exterior_main_entrance_type: "",
  exterior_main_entrance_condition: "",
  exterior_landscaping: "",
  exterior_entrance_count: "",
  exterior_notes: "",
  interior_floors_type: "",
  interior_floors_condition: "",
  interior_walls_type: "",
  interior_walls_condition: "",
  interior_ceilings_type: "",
  interior_ceilings_condition: "",
  interior_kitchen_type: "",
  interior_kitchen_condition: "",
  interior_bathrooms_count: "",
  interior_bathrooms_condition: "",
  interior_doors_type: "",
  interior_doors_condition: "",
  interior_windows_type: "",
  interior_windows_condition: "",
  interior_stairs_type: "",
  interior_stairs_condition: "",
  interior_ac_type: "",
  interior_ac_condition: "",
  interior_electrical_condition: "",
  interior_plumbing_condition: "",
  interior_rooms_count: "",
  interior_halls_count: "",
  interior_bathrooms_count_num: "",
  interior_kitchens_count: "",
  interior_overall_finishing: "",
  interior_notes: "",
  overall_condition: "",
  asset_age: "",
  finishing_level: "",
  condition_notes: "",
  maintenance_rating: "",
  cracks_severity: "none",
  moisture_severity: "none",
  corrosion_severity: "none",
  fire_damage_severity: "none",
  structural_damage_severity: "none",
  damage_details: "",
  electricity_status: "",
  electricity_condition: "",
  water_source: "",
  water_condition: "",
  sewage_type: "",
  sewage_condition: "",
  roads_paved: false,
  gas_status: "",
  internet_status: "",
  central_ac_status: "",
  elevator_status: "",
  elevator_count: "",
  utilities_notes: "",
  utilities_confidential_notes: "",
  total_building_area: "",
  floor_areas: "",
  floor_count_detail: "",
  layout_notes: "",
  garden_area: "",
  parking_area: "",
  annex_area: "",
  area_matches_license: "",
  positive_factors: {} as Record<string, string>,
  negative_factors: {} as Record<string, string>,
  negative_factors_other: "",
  positive_factors_other: "",
  environmental_factors: "",
  regulatory_factors: "",
  inspector_observations: "",
  inspector_recommendations: "",
  additional_notes: "",
  inspector_verdict: "",
  inspector_verdict_notes: "",
  has_risks: "",
  risk_details: "",
  data_complete: "",
  inspector_final_notes: "",
  confidential_notes: "",
  approval_inspector_name: "",
  approval_date: new Date().toISOString().split("T")[0],
};

export interface SectionProps {
  formData: FormData;
  updateField: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}

export interface SectionWithPhotosProps extends SectionProps {
  sectionPhotos: SectionPhoto[];
  onAddPhoto: (photo: SectionPhoto) => void;
  onRemovePhoto: (photo: SectionPhoto) => void;
}
