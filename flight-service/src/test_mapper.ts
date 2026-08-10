import TripjackFieldMapper from "./utils/mappers/tripjackField.mapper";

const input = {
    flightKey: "123",
    segments: [],
    fares: [
        {
            fareId: "e445b204e13511100f91aefc3a3cb0",
            fareIdentifier: "PUBLISHED",
            id: "e445b204e13511100f91aefc3a3cb0",
            fd: {
                ADULT: {
                    fC: { TF: 100 }
                }
            }
        }
    ]
};

const output = TripjackFieldMapper.map(input);
console.log(JSON.stringify(output, null, 2));
