// Danh mục đơn vị hành chính Việt Nam & dịch vụ định vị tọa độ thông minh (Geocoding)

export interface WardItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface DistrictItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  wards: WardItem[];
}

export interface ProvinceItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  districts: DistrictItem[];
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  source: 'nominatim' | 'administrative' | 'fallback';
}

export const VIETNAM_PROVINCES: ProvinceItem[] = [
  {
    id: 'binh_phuoc',
    name: 'Tỉnh Bình Phước',
    lat: 11.7512,
    lng: 106.9042,
    districts: [
      {
        id: 'dong_phu',
        name: 'Huyện Đồng Phú',
        lat: 11.5400,
        lng: 106.8500,
        wards: [
          { id: 'dp_tan_lap', name: 'Xã Tân Lập', lat: 11.5120, lng: 106.6025 },
          { id: 'dp_tan_hoa', name: 'Xã Tân Hòa', lat: 11.6210, lng: 106.6710 },
          { id: 'dp_tan_phu', name: 'Thị trấn Tân Phú', lat: 11.5300, lng: 106.9100 },
          { id: 'dp_tan_tien', name: 'Xã Tân Tiến', lat: 11.5540, lng: 106.9230 },
          { id: 'dp_tan_loi', name: 'Xã Tân Lợi', lat: 11.5620, lng: 106.8450 },
          { id: 'dp_thuan_phu', name: 'Xã Thuận Phú', lat: 11.5890, lng: 106.8120 },
          { id: 'dp_thuan_loi', name: 'Xã Thuận Lợi', lat: 11.6420, lng: 106.8350 },
          { id: 'dp_dong_tam', name: 'Xã Đồng Tâm', lat: 11.4580, lng: 106.9210 },
          { id: 'dp_dong_tien', name: 'Xã Đồng Tiến', lat: 11.5030, lng: 106.8540 },
          { id: 'dp_tan_phuoc', name: 'Xã Tân Phước', lat: 11.4720, lng: 106.8850 },
          { id: 'dp_tan_hung', name: 'Xã Tân Hưng', lat: 11.5310, lng: 106.8790 },
        ],
      },
      {
        id: 'dong_xoai',
        name: 'Thành phố Đồng Xoài',
        lat: 11.5333,
        lng: 106.8833,
        wards: [
          { id: 'dx_tan_phu', name: 'Phường Tân Phú', lat: 11.5330, lng: 106.8830 },
          { id: 'dx_tan_dong', name: 'Phường Tân Đồng', lat: 11.5280, lng: 106.9010 },
          { id: 'dx_tan_binh', name: 'Phường Tân Bình', lat: 11.5420, lng: 106.8890 },
          { id: 'dx_tan_xuan', name: 'Phường Tân Xuân', lat: 11.5210, lng: 106.9120 },
          { id: 'dx_tan_thien', name: 'Phường Tân Thiện', lat: 11.5380, lng: 106.9050 },
          { id: 'dx_tien_thanh', name: 'Phường Tiến Thành', lat: 11.5550, lng: 106.8750 },
          { id: 'dx_tien_hung', name: 'Xã Tiến Hưng', lat: 11.4890, lng: 106.8840 },
          { id: 'dx_tan_thanh', name: 'Xã Tân Thành', lat: 11.5690, lng: 106.8520 },
        ],
      },
      {
        id: 'chon_thanh',
        name: 'Thị xã Chơn Thành',
        lat: 11.4780,
        lng: 106.6430,
        wards: [
          { id: 'ct_hung_long', name: 'Phường Hưng Long', lat: 11.4780, lng: 106.6430 },
          { id: 'ct_minh_hung', name: 'Phường Minh Hưng', lat: 11.5120, lng: 106.6320 },
          { id: 'ct_minh_thanh', name: 'Phường Minh Thành', lat: 11.4520, lng: 106.6850 },
          { id: 'ct_thanh_tam', name: 'Phường Thành Tâm', lat: 11.4250, lng: 106.6520 },
          { id: 'ct_nha_bich', name: 'Phường Nha Bích', lat: 11.4920, lng: 106.7120 },
          { id: 'ct_minh_thang', name: 'Xã Minh Thắng', lat: 11.4860, lng: 106.7540 },
          { id: 'ct_minh_lap', name: 'Xã Minh Lập', lat: 11.5340, lng: 106.7210 },
          { id: 'ct_quang_minh', name: 'Xã Quang Minh', lat: 11.4420, lng: 106.7320 },
        ],
      },
      {
        id: 'hon_quan',
        name: 'Huyện Hớn Quản',
        lat: 11.6240,
        lng: 106.6020,
        wards: [
          { id: 'hq_tan_khai', name: 'Thị trấn Tân Khai', lat: 11.6240, lng: 106.6020 },
          { id: 'hq_an_khuong', name: 'Xã An Khương', lat: 11.6850, lng: 106.6210 },
          { id: 'hq_dong_no', name: 'Xã Đồng Nơ', lat: 11.6420, lng: 106.6540 },
          { id: 'hq_tan_hiep', name: 'Xã Tân Hiệp', lat: 11.5890, lng: 106.5680 },
          { id: 'hq_tan_loi', name: 'Xã Tân Lợi', lat: 11.6110, lng: 106.5820 },
          { id: 'hq_thanh_an', name: 'Xã Thanh An', lat: 11.6540, lng: 106.5410 },
          { id: 'hq_phuoc_an', name: 'Xã Phước An', lat: 11.5680, lng: 106.6340 },
        ],
      },
      {
        id: 'binh_long',
        name: 'Thị xã Bình Long',
        lat: 11.7050,
        lng: 106.6020,
        wards: [
          { id: 'bl_an_loc', name: 'Phường An Lộc', lat: 11.7050, lng: 106.6020 },
          { id: 'bl_hung_chien', name: 'Phường Hưng Chiến', lat: 11.6910, lng: 106.6130 },
          { id: 'bl_phu_duc', name: 'Phường Phú Đức', lat: 11.7140, lng: 106.5920 },
          { id: 'bl_phu_thinh', name: 'Phường Phú Thịnh', lat: 11.7250, lng: 106.6080 },
          { id: 'bl_thanh_luong', name: 'Xã Thanh Lương', lat: 11.7420, lng: 106.5810 },
          { id: 'bl_thanh_phu', name: 'Xã Thanh Phú', lat: 11.6820, lng: 106.5640 },
        ],
      },
      {
        id: 'phu_rieng',
        name: 'Huyện Phú Riềng',
        lat: 11.7820,
        lng: 106.9150,
        wards: [
          { id: 'pr_phu_rieng', name: 'Xã Phú Riềng', lat: 11.7820, lng: 106.9150 },
          { id: 'pr_bu_nho', name: 'Xã Bù Nho', lat: 11.8150, lng: 106.9420 },
          { id: 'pr_long_ha', name: 'Xã Long Hà', lat: 11.7520, lng: 106.8710 },
          { id: 'pr_long_tan', name: 'Xã Long Tân', lat: 11.7240, lng: 106.9320 },
          { id: 'pr_binh_tan', name: 'Xã Bình Tân', lat: 11.7910, lng: 106.8540 },
          { id: 'pr_phuoc_tan', name: 'Xã Phước Tân', lat: 11.8340, lng: 106.8920 },
        ],
      },
      {
        id: 'loc_ninh',
        name: 'Huyện Lộc Ninh',
        lat: 11.8540,
        lng: 106.5920,
        wards: [
          { id: 'ln_loc_ninh', name: 'Thị trấn Lộc Ninh', lat: 11.8540, lng: 106.5920 },
          { id: 'ln_loc_tan', name: 'Xã Lộc Tấn', lat: 11.9120, lng: 106.5810 },
          { id: 'ln_loc_thai', name: 'Xã Lộc Thái', lat: 11.8320, lng: 106.6150 },
          { id: 'ln_loc_hiep', name: 'Xã Lộc Hiệp', lat: 11.8740, lng: 106.6430 },
          { id: 'ln_loc_thuan', name: 'Xã Lộc Thuận', lat: 11.8120, lng: 106.5540 },
        ],
      },
      {
        id: 'bu_dang',
        name: 'Huyện Bù Đăng',
        lat: 11.7650,
        lng: 107.2410,
        wards: [
          { id: 'bd_duc_phong', name: 'Thị trấn Đức Phong', lat: 11.7650, lng: 107.2410 },
          { id: 'bd_doan_ket', name: 'Xã Đoàn Kết', lat: 11.7420, lng: 107.2840 },
          { id: 'bd_tho_son', name: 'Xã Thọ Sơn', lat: 11.8120, lng: 107.2150 },
          { id: 'bd_bom_bo', name: 'Xã Bom Bo', lat: 11.8340, lng: 107.1540 },
          { id: 'bd_binh_minh', name: 'Xã Bình Minh', lat: 11.7920, lng: 107.1890 },
        ],
      },
      {
        id: 'bu_gia_map',
        name: 'Huyện Bù Gia Mập',
        lat: 12.0210,
        lng: 107.0540,
        wards: [
          { id: 'bgm_da_kia', name: 'Xã Đa Kia', lat: 11.9240, lng: 106.9850 },
          { id: 'bgm_dak_o', name: 'Xã Đắk Ơ', lat: 12.0520, lng: 107.0850 },
          { id: 'bgm_bu_gia_map', name: 'Xã Bù Gia Mập', lat: 12.1120, lng: 107.1540 },
          { id: 'bgm_phu_van', name: 'Xã Phú Văn', lat: 11.9650, lng: 107.0210 },
          { id: 'bgm_duc_hanh', name: 'Xã Đức Hạnh', lat: 11.9420, lng: 106.9540 },
        ],
      },
      {
        id: 'bu_dop',
        name: 'Huyện Bù Đốp',
        lat: 11.9820,
        lng: 106.8210,
        wards: [
          { id: 'bdp_thanh_binh', name: 'Thị trấn Thanh Bình', lat: 11.9820, lng: 106.8210 },
          { id: 'bdp_thien_hung', name: 'Xã Thiện Hưng', lat: 12.0120, lng: 106.8450 },
          { id: 'bdp_hung_phuoc', name: 'Xã Hưng Phước', lat: 12.0450, lng: 106.7910 },
          { id: 'bdp_phuoc_thien', name: 'Xã Phước Thiện', lat: 11.9540, lng: 106.8020 },
        ],
      },
    ],
  },
  {
    id: 'binh_duong',
    name: 'Tỉnh Bình Dương',
    lat: 11.1604,
    lng: 106.6570,
    districts: [
      {
        id: 'bd_thu_dau_mot',
        name: 'Thành phố Thủ Dầu Một',
        lat: 10.9804,
        lng: 106.6519,
        wards: [
          { id: 'tdm_phu_hoa', name: 'Phường Phú Hòa', lat: 10.9720, lng: 106.6710 },
          { id: 'tdm_phu_cuong', name: 'Phường Phú Cường', lat: 10.9800, lng: 106.6520 },
          { id: 'tdm_dinh_hoa', name: 'Phường Định Hòa', lat: 11.0250, lng: 106.6610 },
          { id: 'tdm_hoa_phu', name: 'Phường Hòa Phú (TP Mới)', lat: 11.0540, lng: 106.6780 },
        ],
      },
      {
        id: 'bd_ben_cat',
        name: 'Thành phố Bến Cát',
        lat: 11.1340,
        lng: 106.6020,
        wards: [
          { id: 'bc_my_phuoc', name: 'Phường Mỹ Phước', lat: 11.1340, lng: 106.6020 },
          { id: 'bc_thoi_hoa', name: 'Phường Thới Hòa', lat: 11.1120, lng: 106.6150 },
          { id: 'bc_chanh_phu_hoa', name: 'Phường Chánh Phú Hòa', lat: 11.1620, lng: 106.6540 },
          { id: 'bc_tay_nam', name: 'Xã An Tây', lat: 11.1210, lng: 106.5410 },
        ],
      },
      {
        id: 'bd_bau_bang',
        name: 'Huyện Bàu Bàng',
        lat: 11.2840,
        lng: 106.6120,
        wards: [
          { id: 'bb_lai_uyen', name: 'Thị trấn Lai Uyên', lat: 11.2840, lng: 106.6120 },
          { id: 'bb_tru_van_tho', name: 'Xã Trừ Văn Thố', lat: 11.3540, lng: 106.6340 },
          { id: 'bb_cay_truong', name: 'Xã Cây Trường II', lat: 11.3120, lng: 106.5620 },
          { id: 'bb_long_nguyen', name: 'Xã Long Nguyên', lat: 11.2310, lng: 106.5820 },
        ],
      },
      {
        id: 'bd_phu_giao',
        name: 'Huyện Phú Giáo',
        lat: 11.3210,
        lng: 106.8120,
        wards: [
          { id: 'pg_phuoc_vinh', name: 'Thị trấn Phước Vĩnh', lat: 11.3210, lng: 106.8120 },
          { id: 'pg_vinh_hoa', name: 'Xã Vĩnh Hòa', lat: 11.3540, lng: 106.8420 },
          { id: 'pg_an_binh', name: 'Xã An Bình', lat: 11.3820, lng: 106.8850 },
          { id: 'pg_tam_lap', name: 'Xã Tam Lập', lat: 11.2740, lng: 106.8720 },
        ],
      },
      {
        id: 'bd_dau_tieng',
        name: 'Huyện Dầu Tiếng',
        lat: 11.2750,
        lng: 106.3920,
        wards: [
          { id: 'dt_dau_tieng', name: 'Thị trấn Dầu Tiếng', lat: 11.2750, lng: 106.3920 },
          { id: 'dt_dinh_an', name: 'Xã Định An', lat: 11.3520, lng: 106.3650 },
          { id: 'dt_thanh_tuyen', name: 'Xã Thanh Tuyền', lat: 11.1940, lng: 106.4520 },
        ],
      },
    ],
  },
  {
    id: 'tay_ninh',
    name: 'Tỉnh Tây Ninh',
    lat: 11.3100,
    lng: 106.0980,
    districts: [
      {
        id: 'tn_tp_tay_ninh',
        name: 'Thành phố Tây Ninh',
        lat: 11.3100,
        lng: 106.0980,
        wards: [
          { id: 'tn_p1', name: 'Phường 1', lat: 11.3050, lng: 106.1020 },
          { id: 'tn_p3', name: 'Phường 3', lat: 11.3150, lng: 106.0950 },
          { id: 'tn_ninh_son', name: 'Phường Ninh Sơn', lat: 11.3420, lng: 106.1240 },
        ],
      },
      {
        id: 'tn_trang_bang',
        name: 'Thị xã Trảng Bàng',
        lat: 11.0340,
        lng: 106.3620,
        wards: [
          { id: 'tb_trang_bang', name: 'Phường Trảng Bàng', lat: 11.0340, lng: 106.3620 },
          { id: 'tb_an_tinh', name: 'Phường An Tịnh', lat: 11.0210, lng: 106.3850 },
          { id: 'tb_gia_loc', name: 'Phường Gia Lộc', lat: 11.0520, lng: 106.3450 },
        ],
      },
      {
        id: 'tn_duong_minh_chau',
        name: 'Huyện Dương Minh Châu',
        lat: 11.3420,
        lng: 106.2840,
        wards: [
          { id: 'dmc_dmc', name: 'Thị trấn Dương Minh Châu', lat: 11.3420, lng: 106.2840 },
          { id: 'dmc_suoi_da', name: 'Xã Suối Đá', lat: 11.3820, lng: 106.2540 },
        ],
      },
    ],
  },
  {
    id: 'dong_nai',
    name: 'Tỉnh Đồng Nai',
    lat: 10.9574,
    lng: 106.8427,
    districts: [
      {
        id: 'dn_bien_hoa',
        name: 'Thành phố Biên Hòa',
        lat: 10.9574,
        lng: 106.8427,
        wards: [
          { id: 'bh_trung_dung', name: 'Phường Trung Dũng', lat: 10.9550, lng: 106.8250 },
          { id: 'bh_long_binh', name: 'Phường Long Bình', lat: 10.9420, lng: 106.8920 },
          { id: 'bh_tam_hiep', name: 'Phường Tam Hiệp', lat: 10.9480, lng: 106.8540 },
        ],
      },
      {
        id: 'dn_long_thanh',
        name: 'Huyện Long Thành',
        lat: 10.7840,
        lng: 106.9540,
        wards: [
          { id: 'lt_long_thanh', name: 'Thị trấn Long Thành', lat: 10.7840, lng: 106.9540 },
          { id: 'lt_binh_son', name: 'Xã Bình Sơn', lat: 10.8120, lng: 106.9850 },
        ],
      },
      {
        id: 'dn_thong_nhat',
        name: 'Huyện Thống Nhất',
        lat: 10.9850,
        lng: 107.1240,
        wards: [
          { id: 'tn_dau_giay', name: 'Thị trấn Dầu Giây', lat: 10.9850, lng: 107.1240 },
          { id: 'tn_gia_tan', name: 'Xã Gia Tân 1', lat: 11.0210, lng: 107.1450 },
        ],
      },
    ],
  },
  {
    id: 'ho_chi_minh',
    name: 'Thành phố Hồ Chí Minh',
    lat: 10.8231,
    lng: 106.6297,
    districts: [
      {
        id: 'hcm_thu_duc',
        name: 'Thành phố Thủ Đức',
        lat: 10.8494,
        lng: 106.7717,
        wards: [
          { id: 'td_linh_trung', name: 'Phường Linh Trung', lat: 10.8650, lng: 106.7780 },
          { id: 'td_thao_dien', name: 'Phường Thảo Điền', lat: 10.8050, lng: 106.7320 },
          { id: 'td_tang_nhon_phu', name: 'Phường Tăng Nhơn Phú A', lat: 10.8420, lng: 106.7950 },
        ],
      },
      {
        id: 'hcm_quan_1',
        name: 'Quận 1',
        lat: 10.7769,
        lng: 106.7009,
        wards: [
          { id: 'q1_ben_nghe', name: 'Phường Bến Nghé', lat: 10.7780, lng: 106.7030 },
          { id: 'q1_ben_thanh', name: 'Phường Bến Thành', lat: 10.7720, lng: 106.6950 },
        ],
      },
      {
        id: 'hcm_cu_chi',
        name: 'Huyện Củ Chi',
        lat: 11.0060,
        lng: 106.5120,
        wards: [
          { id: 'cc_cu_chi', name: 'Thị trấn Củ Chi', lat: 11.0060, lng: 106.5120 },
          { id: 'cc_tan_an_hoi', name: 'Xã Tân An Hội', lat: 10.9850, lng: 106.4950 },
        ],
      },
      {
        id: 'hcm_hoc_mon',
        name: 'Huyện Hóc Môn',
        lat: 10.8840,
        lng: 106.5920,
        wards: [
          { id: 'hm_hoc_mon', name: 'Thị trấn Hóc Môn', lat: 10.8840, lng: 106.5920 },
          { id: 'hm_ba_diem', name: 'Xã Bà Điểm', lat: 10.8420, lng: 106.6050 },
        ],
      },
    ],
  },
  {
    id: 'dak_nong',
    name: 'Tỉnh Đắk Nông',
    lat: 12.0040,
    lng: 107.6880,
    districts: [
      {
        id: 'dn_gia_nghia',
        name: 'Thành phố Gia Nghĩa',
        lat: 12.0040,
        lng: 107.6880,
        wards: [
          { id: 'gn_nghia_duc', name: 'Phường Nghĩa Đức', lat: 12.0080, lng: 107.6920 },
          { id: 'gn_nghia_thanh', name: 'Phường Nghĩa Thành', lat: 11.9950, lng: 107.6810 },
        ],
      },
      {
        id: 'dn_dak_rlap',
        name: 'Huyện Đắk R\'lấp',
        lat: 11.9120,
        lng: 107.4520,
        wards: [
          { id: 'drl_kien_duc', name: 'Thị trấn Kiến Đức', lat: 11.9120, lng: 107.4520 },
          { id: 'drl_nhan_co', name: 'Xã Nhân Cơ', lat: 11.9540, lng: 107.5120 },
        ],
      },
    ],
  },
  {
    id: 'dak_lak',
    name: 'Tỉnh Đắk Lắk',
    lat: 12.6667,
    lng: 108.0500,
    districts: [
      {
        id: 'dl_bmt',
        name: 'Thành phố Buôn Ma Thuột',
        lat: 12.6667,
        lng: 108.0500,
        wards: [
          { id: 'bmt_thang_loi', name: 'Phường Thắng Lợi', lat: 12.6710, lng: 108.0480 },
          { id: 'bmt_tan_an', name: 'Phường Tân An', lat: 12.6850, lng: 108.0620 },
        ],
      },
      {
        id: 'dl_cu_mgar',
        name: 'Huyện Cư M\'gar',
        lat: 12.8250,
        lng: 108.0750,
        wards: [
          { id: 'cmg_quang_phu', name: 'Thị trấn Quảng Phú', lat: 12.8250, lng: 108.0750 },
          { id: 'cmg_ea_pok', name: 'Thị trấn Ea Pốk', lat: 12.7840, lng: 108.0520 },
        ],
      },
    ],
  },
  {
    id: 'ba_ria_vung_tau',
    name: 'Tỉnh Bà Rịa - Vũng Tàu',
    lat: 10.5420,
    lng: 107.2430,
    districts: [
      {
        id: 'vt_phu_my',
        name: 'Thị xã Phú Mỹ',
        lat: 10.6020,
        lng: 107.0620,
        wards: [
          { id: 'pm_phu_my', name: 'Phường Phú Mỹ', lat: 10.6020, lng: 107.0620 },
          { id: 'pm_tan_phuoc', name: 'Phường Tân Phước', lat: 10.5840, lng: 107.0850 },
        ],
      },
      {
        id: 'vt_vung_tau',
        name: 'Thành phố Vũng Tàu',
        lat: 10.3460,
        lng: 107.0843,
        wards: [
          { id: 'vt_p1', name: 'Phường 1', lat: 10.3450, lng: 107.0780 },
          { id: 'vt_thang_tam', name: 'Phường Thắng Tam', lat: 10.3540, lng: 107.0910 },
        ],
      },
    ],
  },
  {
    id: 'long_an',
    name: 'Tỉnh Long An',
    lat: 10.5360,
    lng: 106.4130,
    districts: [
      {
        id: 'la_tan_an',
        name: 'Thành phố Tân An',
        lat: 10.5360,
        lng: 106.4130,
        wards: [
          { id: 'ta_p1', name: 'Phường 1', lat: 10.5350, lng: 106.4120 },
          { id: 'ta_p2', name: 'Phường 2', lat: 10.5420, lng: 106.4080 },
        ],
      },
      {
        id: 'la_duc_hoa',
        name: 'Huyện Đức Hòa',
        lat: 10.8740,
        lng: 106.4620,
        wards: [
          { id: 'dh_hau_nghia', name: 'Thị trấn Hậu Nghĩa', lat: 10.8740, lng: 106.4620 },
          { id: 'dh_duc_hoa', name: 'Thị trấn Đức Hòa', lat: 10.8420, lng: 106.4950 },
        ],
      },
    ],
  },
  {
    id: 'lam_dong',
    name: 'Tỉnh Lâm Đồng',
    lat: 11.9404,
    lng: 108.4583,
    districts: [
      {
        id: 'ld_da_lat',
        name: 'Thành phố Đà Lạt',
        lat: 11.9404,
        lng: 108.4583,
        wards: [
          { id: 'dl_p1', name: 'Phường 1', lat: 11.9410, lng: 108.4380 },
          { id: 'dl_p2', name: 'Phường 2', lat: 11.9450, lng: 108.4420 },
        ],
      },
      {
        id: 'ld_bao_loc',
        name: 'Thành phố Bảo Lộc',
        lat: 11.5470,
        lng: 107.8090,
        wards: [
          { id: 'bl_p1', name: 'Phường 1', lat: 11.5470, lng: 107.8090 },
          { id: 'bl_loc_phat', name: 'Phường Lộc Phát', lat: 11.5720, lng: 107.8420 },
        ],
      },
    ],
  },
  {
    id: 'can_tho',
    name: 'Thành phố Cần Thơ',
    lat: 10.0452,
    lng: 105.7469,
    districts: [
      {
        id: 'ct_ninh_kieu',
        name: 'Quận Ninh Kiều',
        lat: 10.0350,
        lng: 105.7820,
        wards: [
          { id: 'nk_tan_an', name: 'Phường Tân An', lat: 10.0320, lng: 105.7850 },
          { id: 'nk_xuan_khanh', name: 'Phường Xuân Khánh', lat: 10.0280, lng: 105.7740 },
        ],
      },
    ],
  },
  {
    id: 'da_nang',
    name: 'Thành phố Đà Nẵng',
    lat: 16.0544,
    lng: 108.2022,
    districts: [
      {
        id: 'dn_hai_chau',
        name: 'Quận Hải Châu',
        lat: 16.0650,
        lng: 108.2210,
        wards: [
          { id: 'hc_thach_thang', name: 'Phường Thạch Thang', lat: 16.0720, lng: 108.2200 },
        ],
      },
    ],
  },
  {
    id: 'ha_noi',
    name: 'Thành phố Hà Nội',
    lat: 21.0285,
    lng: 105.8542,
    districts: [
      {
        id: 'hn_hoan_kiem',
        name: 'Quận Hoàn Kiếm',
        lat: 21.0310,
        lng: 105.8520,
        wards: [
          { id: 'hk_trang_tien', name: 'Phường Tràng Tiền', lat: 11.0260, lng: 105.8580 },
        ],
      },
    ],
  },
];

/**
 * Hàm geocoding thông minh:
 * 1. Thử gọi API OpenStreetMap Nominatim với full address
 * 2. Nếu thành công -> trả về tọa độ chính xác cao
 * 3. Nếu thất bại / offline -> fallback vào tọa độ hành chính đã lưu trong hệ thống
 */
export async function smartGeocodeAddress(
  streetAddress: string,
  wardName: string,
  districtName: string,
  provinceName: string
): Promise<GeocodingResult> {
  const parts = [
    streetAddress.trim(),
    wardName.trim(),
    districtName.trim(),
    provinceName.trim(),
  ].filter(Boolean);

  const fullAddress = parts.join(', ');

  // 1. Tìm fallback từ dữ liệu hành chính
  let fallbackLat = 11.5120; // Default gần trạm cân Bình Phước
  let fallbackLng = 106.6025;

  const foundProvince = VIETNAM_PROVINCES.find((p) => p.name.toLowerCase() === provinceName.toLowerCase());
  if (foundProvince) {
    fallbackLat = foundProvince.lat;
    fallbackLng = foundProvince.lng;

    const foundDistrict = foundProvince.districts.find((d) => d.name.toLowerCase() === districtName.toLowerCase());
    if (foundDistrict) {
      fallbackLat = foundDistrict.lat;
      fallbackLng = foundDistrict.lng;

      const foundWard = foundDistrict.wards.find((w) => w.name.toLowerCase() === wardName.toLowerCase());
      if (foundWard) {
        fallbackLat = foundWard.lat;
        fallbackLng = foundWard.lng;
      }
    }
  }

  // Nếu có địa chỉ cụ thể nhưng dùng fallback hành chính, có thể thêm một chút jitter nhỏ để phân biệt
  if (streetAddress && !foundProvince) {
    fallbackLat = 11.5400;
    fallbackLng = 106.6200;
  }

  // 2. Thử truy vấn Nominatim Geocoding API với timeout 3s
  try {
    const query = fullAddress || `${districtName}, ${provinceName}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=1&countrycodes=vn`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'vi,en',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            displayName: item.display_name || fullAddress,
            source: 'nominatim',
          };
        }
      }
    }
  } catch (err) {
    // Timeout hoặc fetch error -> rơi vào fallback bên dưới
  }

  return {
    lat: Number(fallbackLat.toFixed(6)),
    lng: Number(fallbackLng.toFixed(6)),
    displayName: fullAddress,
    source: 'administrative',
  };
}
