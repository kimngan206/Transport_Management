import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { mockStorage } from '@/services/mockStorage';
import type { TransportRequest, RequestStatus } from '@/types';

export const useBookingStore = defineStore('booking', () => {
  const requests = ref<TransportRequest[]>(mockStorage.getRequests());

  function saveState() {
    mockStorage.saveRequests(requests.value);
  }

  // Getters
  const pendingRequests = computed(() => requests.value.filter((r) => r.status === 'PENDING'));
  const approvedRequests = computed(() => requests.value.filter((r) => r.status === 'APPROVED'));
  const dispatchedRequests = computed(() => requests.value.filter((r) => r.status === 'DISPATCHED'));
  const inprogressRequests = computed(() => requests.value.filter((r) => r.status === 'INPROGRESS'));
  const completedRequests = computed(() => requests.value.filter((r) => r.status === 'COMPLETED'));

  function getMyRequests(userId: number): TransportRequest[] {
    return requests.value.filter((r) => r.requesterId === userId);
  }

  function getDepartmentRequests(departmentId: number): TransportRequest[] {
    return requests.value.filter((r) => r.departmentId === departmentId);
  }

  // Rule 7: Kiểm tra trùng lịch của Requester (cách tối thiểu 45 phút)
  function hasScheduleConflict(
    requesterId: number,
    startTimeStr: string,
    endTimeStr: string,
    excludeRequestId?: number
  ): { hasConflict: boolean; conflictingCode?: string; message?: string } {
    const newStart = new Date(startTimeStr).getTime();
    const newEnd = new Date(endTimeStr).getTime();
    const BUFFER_MS = 45 * 60 * 1000; // 45 phút

    const existingRequests = requests.value.filter(
      (r) =>
        r.requesterId === requesterId &&
        r.id !== excludeRequestId &&
        (r.status === 'APPROVED' || r.status === 'DISPATCHED' || r.status === 'INPROGRESS')
    );

    for (const item of existingRequests) {
      const itemStart = new Date(item.startTime).getTime();
      const itemEnd = new Date(item.endTime).getTime();

      // Kiểm tra xem khoảng thời gian có giao nhau hoặc cách nhau dưới 45 phút không
      const isOverlapOrClose =
        newStart < itemEnd + BUFFER_MS && newEnd > itemStart - BUFFER_MS;

      if (isOverlapOrClose) {
        return {
          hasConflict: true,
          conflictingCode: item.requestCode,
          message: `Trùng hoặc cách dưới 45 phút với yêu cầu đã duyệt [${item.requestCode}: ${item.startTime.slice(11)} ➔ ${item.endTime.slice(11)}]`,
        };
      }
    }

    return { hasConflict: false };
  }

  // Tạo yêu cầu mới
  function createRequest(
    payload: Omit<TransportRequest, 'id' | 'requestCode' | 'status' | 'createdAt' | 'timeline'>
  ): { success: boolean; message: string; data?: TransportRequest } {
    const now = new Date();
    const startTimeDate = new Date(payload.startTime);

    // Rule 6: Rule 30 phút - StartTime >= Now + 30 mins
    const diffMins = (startTimeDate.getTime() - now.getTime()) / (60 * 1000);
    if (diffMins < 30) {
      return {
        success: false,
        message: 'Quy tắc đặt xe: Giờ bắt đầu phải cách thời điểm hiện tại tối thiểu 30 phút!',
      };
    }

    if (new Date(payload.endTime).getTime() <= startTimeDate.getTime()) {
      return {
        success: false,
        message: 'Giờ kết thúc chuyến đi phải sau giờ bắt đầu!',
      };
    }

    // Rule 7: Chống trùng lịch 45 phút
    const conflictCheck = hasScheduleConflict(
      payload.requesterId,
      payload.startTime,
      payload.endTime
    );
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        message: `Quy tắc chống trùng lịch: ${conflictCheck.message}`,
      };
    }

    const codeNum = String(requests.value.length + 1).padStart(3, '0');
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const requestCode = `RQ-${dateStr}-${codeNum}`;
    const timestampStr = now.toISOString().slice(0, 16).replace('T', ' ');

    const newReq: TransportRequest = {
      ...payload,
      id: Date.now(),
      requestCode,
      status: 'PENDING',
      createdAt: timestampStr,
      timeline: [
        {
          status: 'PENDING',
          timestamp: timestampStr,
          actor: payload.requesterName,
          note: `Khởi tạo yêu cầu đặt xe [${payload.purpose}]`,
        },
      ],
    };

    requests.value.unshift(newReq);
    saveState();
    return {
      success: true,
      message: `Đã tạo thành công yêu cầu ${requestCode}! Đã chuyển đến Bộ phận Điều phối để duyệt và xếp xe.`,
      data: newReq,
    };
  }

  // Cập nhật yêu cầu (được dùng bởi Dispatcher/Admin)
  function updateRequest(
    requestId: number,
    payload: Omit<TransportRequest, 'id' | 'requestCode' | 'status' | 'createdAt' | 'timeline'>,
    actorName: string = 'Hệ thống'
  ): { success: boolean; message: string; data?: TransportRequest } {
    const req = requests.value.find((r) => r.id === requestId);
    if (!req) {
      return { success: false, message: 'Không tìm thấy yêu cầu cần cập nhật' };
    }

    if (req.status === 'DISPATCHED' || req.status === 'INPROGRESS' || req.status === 'COMPLETED' || req.status === 'CANCELLED') {
      return { success: false, message: 'Không thể chỉnh sửa yêu cầu đã được điều phối, đang vận chuyển, đã hoàn thành hoặc đã hủy.' };
    }

    const now = new Date();
    const startTimeDate = new Date(payload.startTime);

    if (new Date(payload.endTime).getTime() <= startTimeDate.getTime()) {
      return {
        success: false,
        message: 'Giờ kết thúc chuyến đi phải sau giờ bắt đầu!',
      };
    }

    const conflictCheck = hasScheduleConflict(
      payload.requesterId,
      payload.startTime,
      payload.endTime,
      req.id
    );
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        message: `Quy tắc chống trùng lịch: ${conflictCheck.message}`,
      };
    }

    Object.assign(req, {
      ...payload,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });

    req.timeline.push({
      status: req.status,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor: actorName,
      note: 'Điều phối viên chỉnh sửa thông tin yêu cầu đặt xe',
    });

    saveState();
    return { success: true, message: 'Đã cập nhật thông tin yêu cầu thành công!', data: req };
  }

  // Duyệt yêu cầu
  function approveRequest(
    requestId: number,
    approverId: number,
    approverName: string,
    note?: string
  ): { success: boolean; message: string } {
    const req = requests.value.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy yêu cầu' };

    if (req.status !== 'PENDING') {
      return { success: false, message: 'Yêu cầu không ở trạng thái chờ duyệt (PENDING)' };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    req.status = 'APPROVED';
    req.approvedById = approverId;
    req.approvedByName = approverName;
    req.approvedAt = nowStr;

    req.timeline.push({
      status: 'APPROVED',
      timestamp: nowStr,
      actor: approverName,
      note: note || 'Đã phê duyệt yêu cầu đặt xe',
    });

    saveState();
    return { success: true, message: `Đã phê duyệt yêu cầu ${req.requestCode} thành công!` };
  }

  // Từ chối yêu cầu (bắt buộc lý do)
  function rejectRequest(
    requestId: number,
    approverId: number,
    approverName: string,
    reason: string
  ): { success: boolean; message: string } {
    const req = requests.value.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy yêu cầu' };

    if (!reason || !reason.trim()) {
      return { success: false, message: 'Bắt buộc nhập lý do từ chối yêu cầu (RejectReason)!' };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    req.status = 'REJECTED';
    req.rejectionReason = reason.trim();
    req.approvedById = approverId;
    req.approvedByName = approverName;
    req.approvedAt = nowStr;

    req.timeline.push({
      status: 'REJECTED',
      timestamp: nowStr,
      actor: approverName,
      note: `Từ chối yêu cầu: ${reason.trim()}`,
    });

    saveState();
    return { success: true, message: `Đã từ chối yêu cầu ${req.requestCode}.` };
  }

  // Hủy yêu cầu
  function cancelRequest(
    requestId: number,
    cancelledByName: string,
    reason: string
  ): { success: boolean; message: string } {
    const req = requests.value.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy yêu cầu' };

    // Rule trang 9: INPROGRESS không được Cancel
    if (req.status === 'INPROGRESS' || req.status === 'COMPLETED') {
      return { success: false, message: 'Chuyến xe đang chạy hoặc đã hoàn thành, không thể hủy!' };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    req.status = 'CANCELLED';

    req.timeline.push({
      status: 'CANCELLED',
      timestamp: nowStr,
      actor: cancelledByName,
      note: `Hủy yêu cầu: ${reason || 'Người dùng tự hủy'}`,
    });

    saveState();
    return { success: true, message: `Đã hủy yêu cầu ${req.requestCode}.` };
  }

  function updateRequestStatus(
    requestId: number,
    status: RequestStatus,
    actorName: string,
    note: string,
    tripId?: number,
    routeId?: number
  ) {
    const req = requests.value.find((r) => r.id === requestId);
    if (!req) return;
    req.status = status;
    if (tripId) req.assignedTripId = tripId;
    if (routeId) req.standardRouteId = routeId;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    req.timeline.push({
      status,
      timestamp: nowStr,
      actor: actorName,
      note,
    });
    saveState();
  }

  return {
    requests,
    pendingRequests,
    approvedRequests,
    dispatchedRequests,
    inprogressRequests,
    completedRequests,
    getMyRequests,
    getDepartmentRequests,
    hasScheduleConflict,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    updateRequest,
    updateRequestStatus,
    saveState,
  };
});

