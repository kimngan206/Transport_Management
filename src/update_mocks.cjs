const fs = require('fs');
const file = 'd:/QL_Điều vận/ql-dieuvan-web/src/mocks/index.ts';
let content = fs.readFileSync(file, 'utf8');

// Giữ nguyên Đội 1 cho xe đầu tiên do đã edit thủ công
// Dùng flag để đếm các xe LatexTruck còn lại
let truckCount = 1;

content = content.replace(/vehicleType:\s*'LatexTruck',/g, (match, offset, str) => {
    // Check if teamName is already there (like the first vehicle we manually edited)
    const substring = str.substring(offset, offset + 100);
    if (substring.includes('teamName:')) {
        return match;
    }
    truckCount++;
    return `vehicleType: 'LatexTruck',\n    teamName: 'Đội ${truckCount % 2 === 0 ? 2 : 1}',\n    isExternal: false,`;
});

content = content.replace(/vehicleType:\s*'PassengerCar',/g, (match, offset, str) => {
    const substring = str.substring(offset, offset + 100);
    if (substring.includes('isExternal:')) {
        return match;
    }
    return `vehicleType: 'PassengerCar',\n    isExternal: true,`;
});

content = content.replace(/vehicleType:\s*'MillingMachine',/g, (match, offset, str) => {
    const substring = str.substring(offset, offset + 100);
    if (substring.includes('isExternal:')) {
        return match;
    }
    return `vehicleType: 'MillingMachine',\n    isExternal: false,`;
});

fs.writeFileSync(file, content);
console.log('Updated mock vehicles successfully!');
