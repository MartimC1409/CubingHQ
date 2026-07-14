const ALGORITHMS = {
    "2x2": {
        "EG Method": {
            "CLL": [
                {
                    "name": "CLL AS 1",
                    "alg": "y R U2 R' U' R U' R'"
                },
                {
                    "name": "CLL AS 2",
                    "alg": "R U2 R' F R' F' R U' R U' R'"
                },
                {
                    "name": "CLL AS 3",
                    "alg": "y2 F' L F L' U2 L' U2 L"
                },
                {
                    "name": "CLL AS 4",
                    "alg": "y2 R' F R F' R U R'"
                },
                {
                    "name": "CLL AS 5",
                    "alg": "y2 R U2 R' U2 R' F R F'"
                },
                {
                    "name": "CLL AS 6",
                    "alg": "y' R U2 R' U' R U' R' F R' F' R U R U' R' U'"
                },
                {
                    "name": "CLL H 1",
                    "alg": "F R2 U' R2 U' R2 U R2 F'"
                },
                {
                    "name": "CLL H 2",
                    "alg": "R U R' U R U R' F R' F' R"
                },
                {
                    "name": "CLL H 3",
                    "alg": "y F R U R' U' R U R' U' R U R' U' F'"
                },
                {
                    "name": "CLL H 4",
                    "alg": "y R2 U2 R' U2 R2"
                },
                {
                    "name": "CLL L 1",
                    "alg": "y R U2 R' F' R U2 R' U R' F2 R"
                },
                {
                    "name": "CLL L 2",
                    "alg": "y2 R U2 R2 F2 R U R' F2 R F'"
                },
                {
                    "name": "CLL L 3",
                    "alg": "y2 R' U R' U2 R U' R' U R U' R2"
                },
                {
                    "name": "CLL L 4",
                    "alg": "y R U2 R2 F R F' R U2 R'"
                },
                {
                    "name": "CLL L 5",
                    "alg": "y F R' F' R U R U' R'"
                },
                {
                    "name": "CLL L 6",
                    "alg": "y2 F' R U R' U' R' F R"
                },
                {
                    "name": "CLL Pi 1",
                    "alg": "y F R' F' R U2 R U' R' U R U2 R'"
                },
                {
                    "name": "CLL Pi 2",
                    "alg": "R U2 R' U' R U R' U2 R' F R F'"
                },
                {
                    "name": "CLL Pi 3",
                    "alg": "y F R2 U' R2 U R2 U R2 F'"
                },
                {
                    "name": "CLL Pi 4",
                    "alg": "y2 R' F R F' R U' R' U' R U' R'"
                },
                {
                    "name": "CLL Pi 5",
                    "alg": "y' R' U' R' F R F' R U' R' U2 R"
                },
                {
                    "name": "CLL Pi 6",
                    "alg": "F R U R' U' R U R' U' F'"
                },
                {
                    "name": "CLL Sune 1",
                    "alg": "L' U2 L U2 L F' L' F"
                },
                {
                    "name": "CLL Sune 2",
                    "alg": "R U R' U' R' F R F' R U R' U R U2 R'"
                },
                {
                    "name": "CLL Sune 3",
                    "alg": "R U' R' F R' F' R"
                },
                {
                    "name": "CLL Sune 4",
                    "alg": "F R' F' R U2 R U2 R'"
                },
                {
                    "name": "CLL Sune 5",
                    "alg": "y2 R U R' U R' F R F' R U2 R'"
                },
                {
                    "name": "CLL Sune 6",
                    "alg": "R U R' U R U2 R'"
                },
                {
                    "name": "CLL T 1",
                    "alg": "y' R U R' U' R' F R F'"
                },
                {
                    "name": "CLL T 2",
                    "alg": "y L' U' L U L F' L' F"
                },
                {
                    "name": "CLL T 3",
                    "alg": "F U' R U2 R' U' F2 R U R'"
                },
                {
                    "name": "CLL T 4",
                    "alg": "R' U R U2 R2 F' R U' R' F2 R2"
                },
                {
                    "name": "CLL T 5",
                    "alg": "y2 F R U R' U' R U' R' U' R U R' F'"
                },
                {
                    "name": "CLL T 6",
                    "alg": "R' U R U2 R2 F R F' R"
                },
                {
                    "name": "CLL U 1",
                    "alg": "y' F R U R' U' F'"
                },
                {
                    "name": "CLL U 2",
                    "alg": "R' U' R2 U R' U2 R U2 R' U R'"
                },
                {
                    "name": "CLL U 3",
                    "alg": "y2 F R U R' U2 F' R U' R' F"
                },
                {
                    "name": "CLL U 4",
                    "alg": "y' F R' F' R U' R U' R' U2 R U' R'"
                },
                {
                    "name": "CLL U 5",
                    "alg": "R U' R2 F R F' R U R' U' R U R'"
                },
                {
                    "name": "CLL U 6",
                    "alg": "R' U R' F R F' R U2 R' U R"
                }
            ],
            "EG1": [
                {
                    "name": "EG1 AS 1",
                    "alg": "y R U2 R' U' R U' R'"
                },
                {
                    "name": "EG1 AS 2",
                    "alg": "U R U' R' F' U' F2 R U' R'"
                },
                {
                    "name": "EG1 AS 3",
                    "alg": "F' R U R' U' R U R2 F' R"
                },
                {
                    "name": "EG1 AS 4",
                    "alg": "R U' R' F' U' R U R' U' F"
                },
                {
                    "name": "EG1 AS 5",
                    "alg": "y' R U R' F' U' R U R' U' R U R'"
                },
                {
                    "name": "EG1 AS 6",
                    "alg": "y2 R U' R2 F R U' R' F R F'"
                },
                {
                    "name": "EG1 H 1",
                    "alg": "U' R' F R2 U' R' F R U R' F'"
                },
                {
                    "name": "EG1 H 2",
                    "alg": "U' F' U R U' R2 F2 R U' F"
                },
                {
                    "name": "EG1 H 3",
                    "alg": "U R' F R F' U2 F R U2 R' F"
                },
                {
                    "name": "EG1 H 4",
                    "alg": "U' R U R' F' R U R' U' R U R' U'"
                },
                {
                    "name": "EG1 L 1",
                    "alg": "y R U' R' U R U' R2 F' R F"
                },
                {
                    "name": "EG1 L 2",
                    "alg": "y' U' R' F R U' R' F R2 U R' F' U2"
                },
                {
                    "name": "EG1 L 3",
                    "alg": "y R' U R2 U' R2 U' F R2 U' R'"
                },
                {
                    "name": "EG1 L 4",
                    "alg": "y R' F R2 U R' F' R U2 R'"
                },
                {
                    "name": "EG1 L 5",
                    "alg": "y2 R U R' F' R U R' U' F R' F' R"
                },
                {
                    "name": "EG1 L 6",
                    "alg": "y2 R' U2 F R U2 R U' R2 F"
                },
                {
                    "name": "EG1 Pi 1",
                    "alg": "y2 U' F U' R' F R U' F2 R U R'"
                },
                {
                    "name": "EG1 Pi 2",
                    "alg": "y' R U' R2 F R2 U' R'"
                },
                {
                    "name": "EG1 Pi 3",
                    "alg": "y' F R' F U' F2 R U R"
                },
                {
                    "name": "EG1 Pi 4",
                    "alg": "y' R U' R' U R U' R' F R U' R'"
                },
                {
                    "name": "EG1 Pi 5",
                    "alg": "R U' R2 F R U R U' R' U' R' F R F'"
                },
                {
                    "name": "EG1 Pi 6",
                    "alg": "U' R' F' R U' R' F R2 U R' F' R U R'"
                },
                {
                    "name": "EG1 S 1",
                    "alg": "y2 U' L F' L2 U' L F U L' U L"
                },
                {
                    "name": "EG1 S 2",
                    "alg": "R U R' F2 U F R U R'"
                },
                {
                    "name": "EG1 S 3",
                    "alg": "y2 F R' F' R U R' F' R2 U R'"
                },
                {
                    "name": "EG1 S 4",
                    "alg": "U F' R' F R2 U R' U' F R' F' R U"
                },
                {
                    "name": "EG1 S 5",
                    "alg": "y R U' R' U R U' R' U F R U' R'"
                },
                {
                    "name": "EG1 S 6",
                    "alg": "R' F R2 U' R' U R U' R' F"
                },
                {
                    "name": "EG1 T 1",
                    "alg": "F R U' R2 F' R U R' F' R"
                },
                {
                    "name": "EG1 T 2",
                    "alg": "F' R' F R2 U R' U' R U R'"
                },
                {
                    "name": "EG1 T 3",
                    "alg": "y R U' R2 F R U R U2 R'"
                },
                {
                    "name": "EG1 T 4",
                    "alg": "y' U2 R' F R F' U R U' R' U F R U' R'"
                },
                {
                    "name": "EG1 T 5",
                    "alg": "y' R' F' R2 U R' F' R U R'"
                },
                {
                    "name": "EG1 T 6",
                    "alg": "y' U' R U' R' U2 F R U2 R' F"
                },
                {
                    "name": "EG1 U 1",
                    "alg": "y U2 R U R' U R U' R2 F' R2 U R' U"
                },
                {
                    "name": "EG1 U 2",
                    "alg": "U2 y R' U R' U' R U' R' U' F2 R2"
                },
                {
                    "name": "EG1 U 3",
                    "alg": "F' U2 R U2 R' U2 F"
                },
                {
                    "name": "EG1 U 4",
                    "alg": "y R' F R F' R' F R2 U' R'"
                },
                {
                    "name": "EG1 U 5",
                    "alg": "U2 R U' R' U R U' R' U' F R U' R'"
                },
                {
                    "name": "EG1 U 6",
                    "alg": "y2 R' F R U' R' F R U' R U R' F' U2"
                }
            ],
            "EG2": [
                {
                    "name": "EG2 AS 1",
                    "alg": "F R2 U R' U2 R U R2 U F'"
                },
                {
                    "name": "EG2 AS 2",
                    "alg": "R' U' R U' R' U2 R' F2 R2"
                },
                {
                    "name": "EG2 AS 3",
                    "alg": "U2 R' F R F' R U R B2 R2"
                },
                {
                    "name": "EG2 AS 4",
                    "alg": "U2 F' L F L' U2 L' U2 L' B2 L2"
                },
                {
                    "name": "EG2 AS 5",
                    "alg": "y2 F R F' U R2 F' R U' R"
                },
                {
                    "name": "EG2 AS 6",
                    "alg": "y2 R2 F2 R F R F' R U R'"
                },
                {
                    "name": "EG2 H 1",
                    "alg": "R2 F U2 F2 R2 F' R2"
                },
                {
                    "name": "EG2 H 2",
                    "alg": "y R2 B2 U2 R' U2 R2"
                },
                {
                    "name": "EG2 H 3",
                    "alg": "R' U' R U2 R2 F' R U' F R"
                },
                {
                    "name": "EG2 H 4",
                    "alg": "y' R U2 B2 R' U R U' B R'"
                },
                {
                    "name": "EG2 L 1",
                    "alg": "U L2 B2 L U' L' U L F' L F"
                },
                {
                    "name": "EG2 L 2",
                    "alg": "y2 F2 R2 F R U R' U' R' F R"
                },
                {
                    "name": "EG2 L 3",
                    "alg": "y2 R2 U' R U2 R' U2 R U' F2 R2"
                },
                {
                    "name": "EG2 L 4",
                    "alg": "y' R' U L' U2 R' F R U' R' U' F' x2"
                },
                {
                    "name": "EG2 L 5",
                    "alg": "y F R' F' R U R U' R B2 R2"
                },
                {
                    "name": "EG2 L 6",
                    "alg": "y2 F' R U R' U' R' F R' F2 R2"
                },
                {
                    "name": "EG2 Pi 1",
                    "alg": "F U' R U2 R U' R' U R' F'"
                },
                {
                    "name": "EG2 Pi 2",
                    "alg": "R U2 R2 U R' F2 R2 F'"
                },
                {
                    "name": "EG2 Pi 3",
                    "alg": "U F R2 U' R2 U R2 U R2 F R2 F2 U2"
                },
                {
                    "name": "EG2 Pi 4",
                    "alg": "y2 R' F R F' R U' R' U' R U' R F2 R2"
                },
                {
                    "name": "EG2 Pi 5",
                    "alg": "U' R' F' R' F2 R2 U R' U2 R U"
                },
                {
                    "name": "EG2 Pi 6",
                    "alg": "U R' U2 R U' R2 F2 R F R U'"
                },
                {
                    "name": "EG2 S 1",
                    "alg": "R2 F2 R U R U' R' F R' F' R2 U R' U' R"
                },
                {
                    "name": "EG2 S 2",
                    "alg": "R U R' U R U2 R B2 R2"
                },
                {
                    "name": "EG2 S 3",
                    "alg": "R U' R' F R' F' R' F2 R2"
                },
                {
                    "name": "EG2 S 4",
                    "alg": "F R' F' R U2 R U2 R B2 R2"
                },
                {
                    "name": "EG2 S 5",
                    "alg": "R' U R' F R2 U' F R' F'"
                },
                {
                    "name": "EG2 S 6",
                    "alg": "R2 B2 R' U' R' F R' F' R"
                },
                {
                    "name": "EG2 T 1",
                    "alg": "y' R U R' U' R' F R F'"
                },
                {
                    "name": "EG2 T 2",
                    "alg": "y' F U' R2 U' R' U R2 F'"
                },
                {
                    "name": "EG2 T 3",
                    "alg": "R' U R U2 R2 F' R U' R"
                },
                {
                    "name": "EG2 T 4",
                    "alg": "R2 F2 R U' F R' F' R U R"
                },
                {
                    "name": "EG2 T 5",
                    "alg": "y' R' U2 R U' R' F R' F R F' R"
                },
                {
                    "name": "EG2 T 6",
                    "alg": "y R' U2 R' F2 R F2 R"
                },
                {
                    "name": "EG2 U 1",
                    "alg": "R2 U2 R U R' U F' R U' R"
                },
                {
                    "name": "EG2 U 2",
                    "alg": "R' U' R2 U R' U2 R U2 R' U R'"
                },
                {
                    "name": "EG2 U 3",
                    "alg": "R' F' U' R U2 R' U F R"
                },
                {
                    "name": "EG2 U 4",
                    "alg": "R' F' U' F U2 L' U2 R U' L"
                },
                {
                    "name": "EG2 U 5",
                    "alg": "y2 R2 B2 R' U R' U' R' F R F'"
                },
                {
                    "name": "EG2 U 6",
                    "alg": "y2 R2 F2 R F' R U L F' L' F"
                }
            ]
        }
    },
    "3x3": {
        "OLL": [
            {
                "name": "OLL 1",
                "alg": "R U2 R2 F R F' U2 R' F R F'"
            },
            {
                "name": "OLL 2",
                "alg": "y' R U' R2 D' r U r' D R2 U R'"
            },
            {
                "name": "OLL 3",
                "alg": "y' f R U R' U' f' U' F R U R' U' F'"
            },
            {
                "name": "OLL 4",
                "alg": "y' R' F2 R2 U2 R' F' R U2 R2 F2 R"
            },
            {
                "name": "OLL 5",
                "alg": "r' U2 R U R' U r"
            },
            {
                "name": "OLL 6",
                "alg": "r U2 R' U' R U' r'"
            },
            {
                "name": "OLL 7",
                "alg": "r U R' U R U2 r'"
            },
            {
                "name": "OLL 8",
                "alg": "y2 r' U' R U' R' U2 r"
            },
            {
                "name": "OLL 9",
                "alg": "y R U R' U' R' F R2 U R' U' F'"
            },
            {
                "name": "OLL 10",
                "alg": "R U R' U R' F R F' R U2 R'"
            },
            {
                "name": "OLL 11",
                "alg": "r' R2 U R' U R U2 R' U M'"
            },
            {
                "name": "OLL 12",
                "alg": "y' M' R' U' R U' R' U2 R U' M"
            },
            {
                "name": "OLL 13",
                "alg": "F U R U2 R' U' R U R' F'"
            },
            {
                "name": "OLL 14",
                "alg": "R' F R U R' F' R F U' F'"
            },
            {
                "name": "OLL 15",
                "alg": "r' U' r R' U' R U r' U r"
            },
            {
                "name": "OLL 16",
                "alg": "r U r' R U R' U' r U' r'"
            },
            {
                "name": "OLL 17",
                "alg": "R U R' U R' F R F' U2 R' F R F'"
            },
            {
                "name": "OLL 18",
                "alg": "y R U2 R2 F R F' U2 M' U R U' r'"
            },
            {
                "name": "OLL 19",
                "alg": "y S' R U R' S U' R' F R F'"
            },
            {
                "name": "OLL 20",
                "alg": "r U R' U' M2 U R U' R' U' M'"
            },
            {
                "name": "OLL 21",
                "alg": "R U R' U R U' R' U R U2 R'"
            },
            {
                "name": "OLL 22",
                "alg": "R U2 R2 U' R2 U' R2 U2 R"
            },
            {
                "name": "OLL 23",
                "alg": "R2 D R' U2 R D' R' U2 R'"
            },
            {
                "name": "OLL 24",
                "alg": "r U R' U' r' F R F'"
            },
            {
                "name": "OLL 25",
                "alg": "R U2 R D R' U2 R D' R2"
            },
            {
                "name": "OLL 26",
                "alg": "y R U2 R' U' R U' R'"
            },
            {
                "name": "OLL 27",
                "alg": "R U R' U R U2 R'"
            },
            {
                "name": "OLL 28",
                "alg": "r U R' U' M U R U' R'"
            },
            {
                "name": "OLL 29",
                "alg": "r2 D' r U r' D r2 U' r' U' r"
            },
            {
                "name": "OLL 30",
                "alg": "y' r' D' r U' r' D r2 U' r' U r U r'"
            },
            {
                "name": "OLL 31",
                "alg": "R' U' F U R U' R' F' R"
            },
            {
                "name": "OLL 32",
                "alg": "S R U R' U' R' F R f'"
            },
            {
                "name": "OLL 33",
                "alg": "R U R' U' R' F R F'"
            },
            {
                "name": "OLL 34",
                "alg": "y f R f' U' r' U' R U M'"
            },
            {
                "name": "OLL 35",
                "alg": "R U2 R2 F R F' R U2 R'"
            },
            {
                "name": "OLL 36",
                "alg": "y R U R2 F' U' F U R2 U2 R'"
            },
            {
                "name": "OLL 37",
                "alg": "F R' F' R U R U' R'"
            },
            {
                "name": "OLL 38",
                "alg": "R U R' U R U' R' U' R' F R F'"
            },
            {
                "name": "OLL 39",
                "alg": "y' f' r U r' U' r' F r S"
            },
            {
                "name": "OLL 40",
                "alg": "y R' F R U R' U' F' U R"
            },
            {
                "name": "OLL 41",
                "alg": "y2 R U R' U R U2 R' F R U R' U' F'"
            },
            {
                "name": "OLL 42",
                "alg": "R' U' R U' R' U2 R F R U R' U' F'"
            },
            {
                "name": "OLL 43",
                "alg": "y R' U' F' U F R"
            },
            {
                "name": "OLL 44",
                "alg": "f R U R' U' f'"
            },
            {
                "name": "OLL 45",
                "alg": "F R U R' U' F'"
            },
            {
                "name": "OLL 46",
                "alg": "R' U' R' F R F' U R"
            },
            {
                "name": "OLL 47",
                "alg": "y' F R' F' R U2 R U' R' U R U2 R'"
            },
            {
                "name": "OLL 48",
                "alg": "F R U R' U' R U R' U' F'"
            },
            {
                "name": "OLL 49",
                "alg": "y2 r U' r2 U r2 U r2 U' r"
            },
            {
                "name": "OLL 50",
                "alg": "r' U r2 U' r2 U' r2 U r'"
            },
            {
                "name": "OLL 51",
                "alg": "y2 F U R U' R' U R U' R' F'"
            },
            {
                "name": "OLL 52",
                "alg": "y2 R' F' U' F U' R U R' U R"
            },
            {
                "name": "OLL 53",
                "alg": "r' U' R U' R' U R U' R' U2 r"
            },
            {
                "name": "OLL 54",
                "alg": "r U R' U R U' R' U R U2 r'"
            },
            {
                "name": "OLL 55",
                "alg": "y R' F U R U' R2 F' R2 U R' U' R"
            },
            {
                "name": "OLL 56",
                "alg": "r U r' U R U' R' U R U' R' r U' r'"
            },
            {
                "name": "OLL 57",
                "alg": "R U R' U' M' U R U' r'"
            }
        ],
        "PLL": [
            {
                "name": "Aa",
                "alg": "x R' U R' D2 R U' R' D2 R2 x'"
            },
            {
                "name": "Ab",
                "alg": "x R2 D2 R U R' D2 R U' R x'"
            },
            {
                "name": "E",
                "alg": "y x' R U' R' D R U R' D' R U R' D R U' R' D' x"
            },
            {
                "name": "F",
                "alg": "y R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"
            },
            {
                "name": "Ga",
                "alg": "R2 U R' U R' U' R U' R2 D U' R' U R D'"
            },
            {
                "name": "Gb",
                "alg": "D R' U' R U D' R2 U R' U R U' R U' R2"
            },
            {
                "name": "Gc",
                "alg": "R2 U' R U' R U R' U R2 D' U R U' R' D"
            },
            {
                "name": "Gd",
                "alg": "R U R' U' D R2 U' R U' R' U R' U R2 D'"
            },
            {
                "name": "H",
                "alg": "M2 U' M2 U2 M2 U' M2"
            },
            {
                "name": "Ja",
                "alg": "y2 x R2 F R F' R U2 r' U r U2 x'"
            },
            {
                "name": "Jb",
                "alg": "R U R' F' R U R' U' R' F R2 U' R'"
            },
            {
                "name": "Na",
                "alg": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"
            },
            {
                "name": "Nb",
                "alg": "R' U R U' R' F' U' F R U R' F R' F' R U' R"
            },
            {
                "name": "Ra",
                "alg": "y R U' R' U' R U R D R' U' R D' R' U2 R'"
            },
            {
                "name": "Rb",
                "alg": "R' U2 R U2 R' F R U R' U' R' F' R2"
            },
            {
                "name": "T",
                "alg": "R U R' U' R' F R2 U' R' U' R U R' F'"
            },
            {
                "name": "Ua",
                "alg": "y2 M2 U M U2 M' U M2"
            },
            {
                "name": "Ub",
                "alg": "y2 M2 U' M U2 M' U' M2"
            },
            {
                "name": "V",
                "alg": "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2"
            },
            {
                "name": "Y",
                "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F'"
            },
            {
                "name": "Z",
                "alg": "M' U' M2 U' M2 U' M' U2 M2"
            }
        ],
        "ZBLS": [],
        "ZBLL": [
            {
                "name": "ZBLL Pi 1",
                "alg": "y' R U R' U R U2 R2 F' r U R U' r' F"
            },
            {
                "name": "ZBLL Pi 2",
                "alg": "y' r' F' r U' r' F2 r2 U R' U' r' F R F'"
            },
            {
                "name": "ZBLL Pi 3",
                "alg": "F R U' R' U R U R2 F' R U2 R U' R' U R U2 R' U'"
            },
            {
                "name": "ZBLL Pi 4",
                "alg": "y2 R U R D R' U' R D' R U' R U' R' U2 R"
            },
            {
                "name": "ZBLL Pi 5",
                "alg": "F R' F' R U2 R U2 R' U' r U R' U R U2 r'"
            },
            {
                "name": "ZBLL Pi 6",
                "alg": "F R U R' U' R' F' R U2 R' U' R2 U' R2 U2 R"
            },
            {
                "name": "ZBLL Pi 7",
                "alg": "R2 F R U R U' R' F' R U' R' U' R U R' U R"
            },
            {
                "name": "ZBLL Pi 8",
                "alg": "y F U R U' R' U R U2 R' U' R U R' F'"
            },
            {
                "name": "ZBLL Pi 9",
                "alg": "y' R U R' U R U' R' U' R' F' R U2 R U2 R' F"
            },
            {
                "name": "ZBLL Pi 10",
                "alg": "y' F U' R U' R' U R U R' U2 R U2 R' U F'"
            },
            {
                "name": "ZBLL Pi 11",
                "alg": "y' R F U R2 U2 R2 U R2 U R2 F' R'"
            },
            {
                "name": "ZBLL Pi 12",
                "alg": "R' U' F' R U R' U' R' F R2 U2 R' U2 R"
            },
            {
                "name": "ZBLL Pi 13",
                "alg": "y R2 D' R U2 R' D R2 U R2 D' R U R' D R2"
            },
            {
                "name": "ZBLL Pi 14",
                "alg": "y' R2 D R' U2 R D' R2 U' R2 D R' U' R D' R2"
            },
            {
                "name": "ZBLL Pi 15",
                "alg": "R' U' R U' R2 D' R U R' D R2 U' R' U2 R"
            },
            {
                "name": "ZBLL Pi 16",
                "alg": "R U R' U R2 D R' U' R D' R2 U R U2 R'"
            },
            {
                "name": "ZBLL Pi 17",
                "alg": "R' U' R U R2 F' R U R U' R' F U' R U R' U R"
            },
            {
                "name": "ZBLL Pi 18",
                "alg": "y R U2 R' U' R U2 R' U2 R U' R2 D' R U' R' D R"
            },
            {
                "name": "ZBLL Pi 19",
                "alg": "y' F U R U2 R' U R U R' F' R U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL Pi 20",
                "alg": "y2 R U2 R' U' R U' R' U' F U R U2 R' U R U R' F'"
            },
            {
                "name": "ZBLL Pi 21",
                "alg": "y2 L' U R U' L U' R' U' R U' R'"
            },
            {
                "name": "ZBLL Pi 22",
                "alg": "r' U r U r' U' r U R2 F R F' R"
            },
            {
                "name": "ZBLL Pi 23",
                "alg": "r U' r' U' r U r' U' R2 B' R' B R' U"
            },
            {
                "name": "ZBLL Pi 24",
                "alg": "y' R U R' U F' R U2 R' U2 R' F R"
            },
            {
                "name": "ZBLL Pi 25",
                "alg": "R' U' R' D' R U' R' D R2 U R' U' R U R' U R"
            },
            {
                "name": "ZBLL Pi 26",
                "alg": "R U' R' U' R U' R' U R U R' U R' F' R U R U' R' F"
            },
            {
                "name": "ZBLL Pi 27",
                "alg": "y R U R' U R U' R' U R2 D R' U' R D' R' U' R'"
            },
            {
                "name": "ZBLL Pi 28",
                "alg": "y2 R' U2 R U R' U' R U R2 F R U R U' R' F' R"
            },
            {
                "name": "ZBLL Pi 29",
                "alg": "R U' L' U R' U' L U' R U' L' U R' U' L"
            },
            {
                "name": "ZBLL Pi 30",
                "alg": "y F U R U' R' U R U' R2 F' R U R U' R'"
            },
            {
                "name": "ZBLL Pi 31",
                "alg": "F U R U' R2 F' R2 U R' F' U' F U2 R U' R'"
            },
            {
                "name": "ZBLL Pi 32",
                "alg": "y' R U R' U R U' R2 F R F' R U' R' F' U F"
            },
            {
                "name": "ZBLL Pi 33",
                "alg": "y R' U' R U' B2 R' U2 R U2 l U2 l'"
            },
            {
                "name": "ZBLL Pi 34",
                "alg": "y' R' U' R U' R' U R U' R' U R' D' R U R' D R2"
            },
            {
                "name": "ZBLL Pi 35",
                "alg": "y2 R2 D R' U R D' R' U R' U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL Pi 36",
                "alg": "R' U' R U' R' U2 R U' L' U R U' L U R'"
            },
            {
                "name": "ZBLL Pi 37",
                "alg": "R' F R U R' U' R' F' R2 U' R' U R U' R' U2 R"
            },
            {
                "name": "ZBLL Pi 38",
                "alg": "R U R D R' U R D' R2 U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL Pi 39",
                "alg": "y' R2 F2 R2 U' R U R' U R2 F2 R' U2 R'"
            },
            {
                "name": "ZBLL Pi 40",
                "alg": "y' R' U' R U' R' U R U' R2 D' R U R' D R U R"
            },
            {
                "name": "ZBLL Pi 41",
                "alg": "R U R' U' R' F R2 U R' U' R U R' U' F'"
            },
            {
                "name": "ZBLL Pi 42",
                "alg": "y2 R U2 R' U2 R' F R2 U' R' U2 R U2 R' U' F'"
            },
            {
                "name": "ZBLL Pi 43",
                "alg": "y R U2 R' U' R U R' U' R' D' R U' R' D R2 U' R' U R U' R'"
            },
            {
                "name": "ZBLL Pi 44",
                "alg": "r' F' r U r U2 r' F2 U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL Pi 45",
                "alg": "R U R' U R U2 R' U' R U' L' U R' U' L"
            },
            {
                "name": "ZBLL Pi 46",
                "alg": "y' R' U2 R U R' U R2 U' r' F R' F' r"
            },
            {
                "name": "ZBLL Pi 47",
                "alg": "y R U R' U R U' R' U R U' R D R' U' R D' R2"
            },
            {
                "name": "ZBLL Pi 48",
                "alg": "y' R U R' U F2 R U2 R' U2 R' F2 R"
            },
            {
                "name": "ZBLL Pi 49",
                "alg": "y R U2 R' U2 R' U' F U R2 U' R' U R U' R' F'"
            },
            {
                "name": "ZBLL Pi 50",
                "alg": "y' R U R' F' R U R' U R U2 R' F U R U2 R'"
            },
            {
                "name": "ZBLL Pi 51",
                "alg": "y2 R F U' R2 U2 R U R' U R2 U F' R'"
            },
            {
                "name": "ZBLL Pi 52",
                "alg": "y R U R' U' R U R2 D' R U' R' D R U' R U2 R'"
            },
            {
                "name": "ZBLL Pi 53",
                "alg": "F U R' U' R2 U' R2 U2 R U2 R U R' F'"
            },
            {
                "name": "ZBLL Pi 54",
                "alg": "R U2 R2 F R F' R' F R F' R' F R F' R U2 R'"
            },
            {
                "name": "ZBLL Pi 55",
                "alg": "R2 D R' U' R D' R' U' R' U R U' R' U' R U' R'"
            },
            {
                "name": "ZBLL Pi 56",
                "alg": "R2 D' R U R' D R U R U' R' U R U R' U R"
            },
            {
                "name": "ZBLL Pi 57",
                "alg": "y2 R U2 R' U R' D' R U R' D R2 U' R' U R U' R'"
            },
            {
                "name": "ZBLL Pi 58",
                "alg": "R2 D R' U2 R D' R2 U' R U R D R' U2 R D' R2"
            },
            {
                "name": "ZBLL Pi 59",
                "alg": "y' r U R' U R' F R F' R U' R' U R U2 r'"
            },
            {
                "name": "ZBLL Pi 60",
                "alg": "y R U2 R' U' F' R U2 R' U' R U' R' F R U' R'"
            },
            {
                "name": "ZBLL Pi 61",
                "alg": "R U2 R2 U' R2 U' R2 U2 R"
            },
            {
                "name": "ZBLL Pi 62",
                "alg": "y' R' U2 R U R' U R2 U R' U R U2 R'"
            },
            {
                "name": "ZBLL Pi 63",
                "alg": "y' R U2 R' U2 R U' R' U2 R U' R' U2 R U R'"
            },
            {
                "name": "ZBLL Pi 64",
                "alg": "y R' U2 R U2 R' U R U2 R' U R U2 R' U' R"
            },
            {
                "name": "ZBLL Pi 65",
                "alg": "y2 R' U R U' R2 U2 R U R' U R2 U' R' U R"
            },
            {
                "name": "ZBLL Pi 66",
                "alg": "y2 R U' R' U R2 U2 R' U' R U' R2 U R U' R'"
            },
            {
                "name": "ZBLL Pi 67",
                "alg": "y R U2 R' U' R U' R2 U' R U' R' U2 R"
            },
            {
                "name": "ZBLL Pi 68",
                "alg": "R' U2 R2 U R2 U R2 U2 R'"
            },
            {
                "name": "ZBLL Pi 69",
                "alg": "R U R' U R U2 R' U' R U R' U R U2 R'"
            },
            {
                "name": "ZBLL Pi 70",
                "alg": "R' U' R U' R' U2 R U R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL Pi 71",
                "alg": "y R U R' U R U2 R' U R U R' U R U2 R'"
            },
            {
                "name": "ZBLL Pi 72",
                "alg": "F R U R' U' R U R' U' F' R U R' U' M' U R U' r'"
            },
            {
                "name": "ZBLL U 1",
                "alg": "R U' R' U' R U2 R' U' R' D' R U2 R' D R"
            },
            {
                "name": "ZBLL U 2",
                "alg": "y' R U2 R D R' U2 R D' R' U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL U 3",
                "alg": "y2 R2 D r' U2 r D' R' U2 R'"
            },
            {
                "name": "ZBLL U 4",
                "alg": "y R U R2 D' R U R' D R2 U2 R'"
            },
            {
                "name": "ZBLL U 5",
                "alg": "y' R U2 R2 D' R U2 R' D R2 U' R' U2 R U2 R'"
            },
            {
                "name": "ZBLL U 6",
                "alg": "y2 R2 D R' U2 R D' R' U2 R'"
            },
            {
                "name": "ZBLL U 7",
                "alg": "y2 R' D' r U2 r' D R U2 R U' R' U' R U' R'"
            },
            {
                "name": "ZBLL U 8",
                "alg": "R' U' R U R U R' U' R' U F R U R U' R' F'"
            },
            {
                "name": "ZBLL U 9",
                "alg": "y' R U R' U R U' R' U F' R U2 R' U2 R' F R"
            },
            {
                "name": "ZBLL U 10",
                "alg": "y' R2 D' R U' R' D R2 U R' U R U2 R' U R U2 R' U' R"
            },
            {
                "name": "ZBLL U 11",
                "alg": "y R U R' U R U' R' U R U' R' U' L' U R U' R' L"
            },
            {
                "name": "ZBLL U 12",
                "alg": "y' R U' R' U R U R' U2 R' D' R U R' D R2 U R'"
            },
            {
                "name": "ZBLL U 13",
                "alg": "R2 D' r U2 r' D R U2 R"
            },
            {
                "name": "ZBLL U 14",
                "alg": "y R2 D' R U' R' D R2 U' R' U2 R"
            },
            {
                "name": "ZBLL U 15",
                "alg": "y2 R' U R U R' U2 R U R D R' U2 R D' R'"
            },
            {
                "name": "ZBLL U 16",
                "alg": "y' R' U2 R' D' R U2 R' D R U2 R U R' U R"
            },
            {
                "name": "ZBLL U 17",
                "alg": "R2 D' R U2 R' D R U2 R"
            },
            {
                "name": "ZBLL U 18",
                "alg": "y' R' U2 R2 D R' U2 R D' R2 U R U2 R' U2 R"
            },
            {
                "name": "ZBLL U 19",
                "alg": "y' R' U R U R' U2 R y U2 R U' R' U2 R U' R'"
            },
            {
                "name": "ZBLL U 20",
                "alg": "y2 F R U R' U' R2 D R' U' R D' R2 U' R U R' F'"
            },
            {
                "name": "ZBLL U 21",
                "alg": "R2 D' R U2 R' U' D R' U' R2 U R U R2"
            },
            {
                "name": "ZBLL U 22",
                "alg": "y' R2 F' R U2 R U2 R' F U' R U R' U' R"
            },
            {
                "name": "ZBLL U 23",
                "alg": "y' R' U R U' R' U' R U2 R D R' U' R D' R2 U' R"
            },
            {
                "name": "ZBLL U 24",
                "alg": "F U R U' R D R' U' R D' R2 U R U R' F'"
            },
            {
                "name": "ZBLL U 25",
                "alg": "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R"
            },
            {
                "name": "ZBLL U 26",
                "alg": "r2 F2 r U2 r U' L' U R' U R U' L"
            },
            {
                "name": "ZBLL U 27",
                "alg": "y' F2 R U' R' U' R U R' F' R U R' U' R' F R F2"
            },
            {
                "name": "ZBLL U 28",
                "alg": "R2 B2 R' B2 R' U R U' L U' L' U R'"
            },
            {
                "name": "ZBLL U 29",
                "alg": "y' F U R2 D' R U' R' D R2 F' R' U R"
            },
            {
                "name": "ZBLL U 30",
                "alg": "y' R' U' R F R2 D' R U R' D R2 U' F'"
            },
            {
                "name": "ZBLL U 31",
                "alg": "y R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R' U2 R"
            },
            {
                "name": "ZBLL U 32",
                "alg": "y' R2 F' R U R' U' R' F R2 U' R' U2 R2 U R' U R"
            },
            {
                "name": "ZBLL U 33",
                "alg": "y F U R U2 R' U R U R2 F' r U R U' r'"
            },
            {
                "name": "ZBLL U 34",
                "alg": "y R U R' U R U2 R' U R U2 R D R' U2 R D' R2"
            },
            {
                "name": "ZBLL U 35",
                "alg": "y' r U R' U' r' F R2 U' R' U' R U2 R' U' F'"
            },
            {
                "name": "ZBLL U 36",
                "alg": "R2 F R U R U' R' F' R U' R2 D' R U R' D R2"
            },
            {
                "name": "ZBLL U 37",
                "alg": "y2 R U R' U R U R' U2 R U' R2 D' R U' R' D R"
            },
            {
                "name": "ZBLL U 38",
                "alg": "R U R' U R U' R' U2 R' D' R U2 R' D R2 U' R'"
            },
            {
                "name": "ZBLL U 39",
                "alg": "R' U' R U2 R' F' R U R' U' R' F R2 U2 R' U R"
            },
            {
                "name": "ZBLL U 40",
                "alg": "y R2 D' R U2 R' D R U2 R U R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL U 41",
                "alg": "x' R2 D2 R' U2 R D2 R' U2 R' x"
            },
            {
                "name": "ZBLL U 42",
                "alg": "y2 x R2 D2 R U2 R' D2 R U2 R x'"
            },
            {
                "name": "ZBLL U 43",
                "alg": "F R U' R' U R U R' U R U' R' F'"
            },
            {
                "name": "ZBLL U 44",
                "alg": "y2 R U' R2 F R U R U' R2 F' R U' F' U F"
            },
            {
                "name": "ZBLL U 45",
                "alg": "R U R' U R' D' R U2 R' D R2 U' R' U2 R U2 R'"
            },
            {
                "name": "ZBLL U 46",
                "alg": "y' R U' R' U' R U' R' U R' D' R U R' D R2 U R'"
            },
            {
                "name": "ZBLL U 47",
                "alg": "R' U2 R U R' U R' D' R U' R' D R U R"
            },
            {
                "name": "ZBLL U 48",
                "alg": "y2 R U2 R' U' R U' R D R' U R D' R' U' R'"
            },
            {
                "name": "ZBLL U 49",
                "alg": "R U' R' U' R U R D R' U R D' R2"
            },
            {
                "name": "ZBLL U 50",
                "alg": "y' F R U R' U' R U R' U' F' U' R' F' U' F U R"
            },
            {
                "name": "ZBLL U 51",
                "alg": "R U R' L' U2 R U' R' U' R U' R' L"
            },
            {
                "name": "ZBLL U 52",
                "alg": "R2 D' R U R' D R U R U' R' U' R"
            },
            {
                "name": "ZBLL U 53",
                "alg": "F U R U2 R' U R U R' U R U2 R' U R U R' F'"
            },
            {
                "name": "ZBLL U 54",
                "alg": "y' r U R' U' M U R U' R' F R U R' U' F'"
            },
            {
                "name": "ZBLL U 55",
                "alg": "y' r U2 R2 F R F' U2 r' R U R U' R'"
            },
            {
                "name": "ZBLL U 56",
                "alg": "y R' D R2 U' R' U R U2 R' U' R U R2 D' R"
            },
            {
                "name": "ZBLL U 57",
                "alg": "y' R' D' R U' R' D R2 U2 R' U R U R'"
            },
            {
                "name": "ZBLL U 58",
                "alg": "M' U R' U' F' U F R2 U R' U R U2 r'"
            },
            {
                "name": "ZBLL U 59",
                "alg": "y2 R' U R U R' U' R' D' R U' R' D R2"
            },
            {
                "name": "ZBLL U 60",
                "alg": "y2 R' U' F' U F U' R S' R' U R S"
            },
            {
                "name": "ZBLL U 61",
                "alg": "y' R' U' R U R' U R U2 R' U R U2 R' U' R"
            },
            {
                "name": "ZBLL U 62",
                "alg": "y' R U R' U' R U' R' U2 R U' R' U2 R U R'"
            },
            {
                "name": "ZBLL U 63",
                "alg": "y R U2 R' U' R U' R' U' R U R' U R U2 R'"
            },
            {
                "name": "ZBLL U 64",
                "alg": "y R' U2 R2 U R2 U R U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL U 65",
                "alg": "y R' U2 R U R' U R U R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL U 66",
                "alg": "y R U2 R2 U' R2 U' R' U R' U' R U R' U R"
            },
            {
                "name": "ZBLL U 67",
                "alg": "y2 R U R' U R' U2 R2 U R2 U R2 U' R'"
            },
            {
                "name": "ZBLL U 68",
                "alg": "R' U' R U' R U2 R2 U' R2 U' R2 U R"
            },
            {
                "name": "ZBLL U 69",
                "alg": "R' U' R U' R' U2 R2 U R' U R U2 R'"
            },
            {
                "name": "ZBLL U 70",
                "alg": "y2 R U R' U R U2 R2 U' R U' R' U2 R"
            },
            {
                "name": "ZBLL U 71",
                "alg": "R U R' U' R U' R U2 R2 U' R U R' U' R2 U' R2"
            },
            {
                "name": "ZBLL U 72",
                "alg": "y R U2 R' U' R U' R' L' U2 L U L' U L"
            },
            {
                "name": "ZBLL T 1",
                "alg": "y R' U' R U' R' U' R U2 L' R' U R U' L"
            },
            {
                "name": "ZBLL T 2",
                "alg": "y R' U2 R2 U R' U' R' U2 F' R U2 R U2 R' F"
            },
            {
                "name": "ZBLL T 3",
                "alg": "y2 R' U' R' D' R U' M' U2 r' D R2"
            },
            {
                "name": "ZBLL T 4",
                "alg": "y2 F R2 D R' U' R D' R2 U' R U2 R' U' F'"
            },
            {
                "name": "ZBLL T 5",
                "alg": "y F R U R' U' R U R' U' F' R U R' U' R' F R F'"
            },
            {
                "name": "ZBLL T 6",
                "alg": "y2 R' U' R' D' R U R' D R2"
            },
            {
                "name": "ZBLL T 7",
                "alg": "R' U2 R F U' R' U R U F' R' U R"
            },
            {
                "name": "ZBLL T 8",
                "alg": "y' R' U' R U R' U R L' U R' U' R L"
            },
            {
                "name": "ZBLL T 9",
                "alg": "y F U R U2 R' U R U R' F'"
            },
            {
                "name": "ZBLL T 10",
                "alg": "y R U R' U' R' F' R U2 R U2 R' F"
            },
            {
                "name": "ZBLL T 11",
                "alg": "y' F U R' U' R F' R' U' R U R' U R"
            },
            {
                "name": "ZBLL T 12",
                "alg": "y' R' U R U R' U' R' D' R U2 R' D R U R"
            },
            {
                "name": "ZBLL T 13",
                "alg": "y2 R' U' R U D' R U' R U R U' R2 D"
            },
            {
                "name": "ZBLL T 14",
                "alg": "y' R' D' R U R' D R2 U' R' U R U R' U' R U R'"
            },
            {
                "name": "ZBLL T 15",
                "alg": "y R U R' U R U R' U2 L R U' R' U L'"
            },
            {
                "name": "ZBLL T 16",
                "alg": "y2 F R U R' U' R' F' U2 R U R U' R2 U2 R"
            },
            {
                "name": "ZBLL T 17",
                "alg": "y' r U R' U' r' F R F'"
            },
            {
                "name": "ZBLL T 18",
                "alg": "R' U' R U' R2 F' R U R U' R' F U R U' R' U2 R"
            },
            {
                "name": "ZBLL T 19",
                "alg": "U2 R U R D R' U2 R D' R' U' R' U R U' R' U' R U' R'"
            },
            {
                "name": "ZBLL T 20",
                "alg": "y' R U R' U' R U' R' L U' R U R' L'"
            },
            {
                "name": "ZBLL T 21",
                "alg": "y' R U2 R' U2 R' F R U R U' R' F'"
            },
            {
                "name": "ZBLL T 22",
                "alg": "y' F' U' r' F2 r U F R U' R'"
            },
            {
                "name": "ZBLL T 23",
                "alg": "y' R U' R' U' R U R D R' U2 R D' R' U' R'"
            },
            {
                "name": "ZBLL T 24",
                "alg": "y2 R L' U R' U' L U R U R' U' R U' R'"
            },
            {
                "name": "ZBLL T 25",
                "alg": "R' U R U2 L' R' U R U' L"
            },
            {
                "name": "ZBLL T 26",
                "alg": "y R U R2 F R F' R U' R' F' U F"
            },
            {
                "name": "ZBLL T 27",
                "alg": "y2 R U' R' U2 L R U' R' U L'"
            },
            {
                "name": "ZBLL T 28",
                "alg": "y' R' U' R' D' R U R' D R U2 R U R' U R"
            },
            {
                "name": "ZBLL T 29",
                "alg": "F R U' R' U' R U2 R' U' F' R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL T 30",
                "alg": "R' U2 R U R' U R F U R U2 R' U R U R' F'"
            },
            {
                "name": "ZBLL T 31",
                "alg": "y2 r U' r U2 R' F R U2 r2 F"
            },
            {
                "name": "ZBLL T 32",
                "alg": "y2 R' U' R2 U R' F' R U R' U' R' F R2 U' R' U' R' U R"
            },
            {
                "name": "ZBLL T 33",
                "alg": "R U' R' U R U R' U' R U R' U' R' D' R U' R' D R"
            },
            {
                "name": "ZBLL T 34",
                "alg": "R U R' U R U' R' U' L' U2 R U2 R' U2 L"
            },
            {
                "name": "ZBLL T 35",
                "alg": "y2 R' D' R U R' D R U R U' R' U R U' R' U' R U R'"
            },
            {
                "name": "ZBLL T 36",
                "alg": "y L' U2 R U2 R' U2 L U R U R' U' R U' R'"
            },
            {
                "name": "ZBLL T 37",
                "alg": "R' D' R U R' D R2 U R' U2 R U' R' U' R U' R'"
            },
            {
                "name": "ZBLL T 38",
                "alg": "y' R U R2 D' R U2 R' D R U2 R U R' U' R U' R'"
            },
            {
                "name": "ZBLL T 39",
                "alg": "y R' U' R U' F U' R' U R U F' R' U R"
            },
            {
                "name": "ZBLL T 40",
                "alg": "R' U2 R' D' R U2 R' D R2 U' R' U2 R U R' U R"
            },
            {
                "name": "ZBLL T 41",
                "alg": "y' l' U2 R' D2 R U2 R' D2 R2 x'"
            },
            {
                "name": "ZBLL T 42",
                "alg": "y' l U2 R D2 R' U2 R D2 R2 x"
            },
            {
                "name": "ZBLL T 43",
                "alg": "y2 F R U R' U' R U' R' U' R U R' F'"
            },
            {
                "name": "ZBLL T 44",
                "alg": "y' R U R' U2 R U' R' U2 R U' R2 F' R U R U' R' F"
            },
            {
                "name": "ZBLL T 45",
                "alg": "y R' U' R' D' R U R' D R U' R U' R' U2 R"
            },
            {
                "name": "ZBLL T 46",
                "alg": "y R U R' U R' D' R U' R' D R U R U2 R'"
            },
            {
                "name": "ZBLL T 47",
                "alg": "r U R' U' r' F R F' R' U2 R U R' U R"
            },
            {
                "name": "ZBLL T 48",
                "alg": "y2 R U2 R' U' R U' R2 F' r U R U' r' F"
            },
            {
                "name": "ZBLL T 49",
                "alg": "y R' U' R U R' U' R2 D R' U R D' R' U2 R' U R"
            },
            {
                "name": "ZBLL T 50",
                "alg": "R U' R' U R U R' U' R U R' U R' D' R U R' D R"
            },
            {
                "name": "ZBLL T 51",
                "alg": "y R U' R2 D' r U2 r' D R2 U' R' U' R U' R'"
            },
            {
                "name": "ZBLL T 52",
                "alg": "y2 R U R' U2 R' D' R U R' D R2 U' R' U R U' R'"
            },
            {
                "name": "ZBLL T 53",
                "alg": "y2 r2 U R' U' r' F R F' U R' U' r' F R F'"
            },
            {
                "name": "ZBLL T 54",
                "alg": "y2 R2 F R U R' U' R' F' R' U' R2 U2 R U2 R"
            },
            {
                "name": "ZBLL T 55",
                "alg": "y2 R U' R2 D' r U2 r' D R2 U R'"
            },
            {
                "name": "ZBLL T 56",
                "alg": "R' U R2 D r' U2 r D' R2 U' R"
            },
            {
                "name": "ZBLL T 57",
                "alg": "R' U' R U2 R D R' U' R D' R2 U R U' R' U R"
            },
            {
                "name": "ZBLL T 58",
                "alg": "y R' D' R U' R' D R U' R U' R' U R U' R' U' R U R'"
            },
            {
                "name": "ZBLL T 59",
                "alg": "y R U R' U' R U R2 D' R U' R' D R U2 R U' R'"
            },
            {
                "name": "ZBLL T 60",
                "alg": "y2 R U R' F' R U R' U' R' F R U' R' F R U R U' R' F'"
            },
            {
                "name": "ZBLL T 61",
                "alg": "y2 R U' R' U2 R U R' U2 R U R' U R U' R'"
            },
            {
                "name": "ZBLL T 62",
                "alg": "y' R U R' U R U2 R' U' R U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL T 63",
                "alg": "y' R U R' U R U' R' U R' U' R2 U' R2 U2 R"
            },
            {
                "name": "ZBLL T 64",
                "alg": "R U2 R' U' R U' R' U R U R' U R U2 R'"
            },
            {
                "name": "ZBLL T 65",
                "alg": "y' R' U' R U' R' U R U' R U R2 U R2 U2 R'"
            },
            {
                "name": "ZBLL T 66",
                "alg": "y2 R' U2 R U R' U R U' R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL T 67",
                "alg": "y' R' U' R2 U R2 U R2 U2 R' U R' U R"
            },
            {
                "name": "ZBLL T 68",
                "alg": "y' R U R2 U' R2 U' R2 U2 R U' R U' R'"
            },
            {
                "name": "ZBLL T 69",
                "alg": "R U2 R' U' R U' R2 U2 R U R' U R"
            },
            {
                "name": "ZBLL T 70",
                "alg": "y2 R' U2 R U R' U R2 U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL T 71",
                "alg": "R' U R U2 R' U' R U' R U R' U' R' U' R U R U' R'"
            },
            {
                "name": "ZBLL T 72",
                "alg": "y' R U R' U R U2 R' U2 R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL L 1",
                "alg": "y' R' U' R U' R' U2 R' D' R U2 R' D R U2 R"
            },
            {
                "name": "ZBLL L 2",
                "alg": "y R D R' U2 R D' R' U' R' U2 R U' R' U' R"
            },
            {
                "name": "ZBLL L 3",
                "alg": "y' R' U2 R U R2 D' R U R' D R2"
            },
            {
                "name": "ZBLL L 4",
                "alg": "R' U2 R' D' r U2 r' D R2"
            },
            {
                "name": "ZBLL L 5",
                "alg": "R' U2 R U2 R' U' R2 D R' U2 R D' R2 U2 R"
            },
            {
                "name": "ZBLL L 6",
                "alg": "R' U2 R' D' R U2 R' D R2"
            },
            {
                "name": "ZBLL L 7",
                "alg": "y' R' U' R U' R' U' R U2 R D r' U2 r D' R'"
            },
            {
                "name": "ZBLL L 8",
                "alg": "y' F R U' R' U R U R2 D' R U R' D R2 U' R' F'"
            },
            {
                "name": "ZBLL L 9",
                "alg": "y' R' U' R2 D r' U2 r D' R2 U R U R' U2 R"
            },
            {
                "name": "ZBLL L 10",
                "alg": "R' U R U' R' U F' R U2 R' U2 R' F R2"
            },
            {
                "name": "ZBLL L 11",
                "alg": "R' U R2 D R' U R D' R' U2 R' U R U R' U' R"
            },
            {
                "name": "ZBLL L 12",
                "alg": "y' F R U' R' U' R2 D R' U R D' R' U R' U' F'"
            },
            {
                "name": "ZBLL L 13",
                "alg": "R2 D' R U2 R' D R2 U R2 F' R U R U' R' F R"
            },
            {
                "name": "ZBLL L 14",
                "alg": "y R U' R' U R U' R' U' R U R2 D' R U' R' D R"
            },
            {
                "name": "ZBLL L 15",
                "alg": "L U' R U R' L' U2 R U' R' U' R U' R'"
            },
            {
                "name": "ZBLL L 16",
                "alg": "R' U2 R2 U R' U' R' U2 F R U R U' R' F'"
            },
            {
                "name": "ZBLL L 17",
                "alg": "R' U' R U' R' U R U' R' U R U' R2 D' R U2 R' D R2"
            },
            {
                "name": "ZBLL L 18",
                "alg": "y F R' F' r U R U' r'"
            },
            {
                "name": "ZBLL L 19",
                "alg": "y' R' U2 R U2 D' R U' R U R U' R2 D"
            },
            {
                "name": "ZBLL L 20",
                "alg": "L R U' R' U L' R U R' U R U' R'"
            },
            {
                "name": "ZBLL L 21",
                "alg": "y R U R D R' U2 R D' R' U' R' U R U R'"
            },
            {
                "name": "ZBLL L 22",
                "alg": "R U R' U R U' R' U' L' U R U' R' L"
            },
            {
                "name": "ZBLL L 23",
                "alg": "y F R U R' U' R' F' R U2 R U2 R'"
            },
            {
                "name": "ZBLL L 24",
                "alg": "y' R' F' R U R' U' R' F R U' R U R' U R"
            },
            {
                "name": "ZBLL L 25",
                "alg": "y' R2 D' r U2 r' R U R' D R U R"
            },
            {
                "name": "ZBLL L 26",
                "alg": "y' R' U R U2 R' L' U R U L U r' F r"
            },
            {
                "name": "ZBLL L 27",
                "alg": "R' D R' U R D' R' U R2 U' R2 U' R2"
            },
            {
                "name": "ZBLL L 28",
                "alg": "y2 F' R U2 R' U2 R' F U2 R U R U' R2 U2 R"
            },
            {
                "name": "ZBLL L 29",
                "alg": "y2 F' r U R' U' r' F R"
            },
            {
                "name": "ZBLL L 30",
                "alg": "y R U R' U R U' R' U R U' R' U R2 D R' U2 R D' R2"
            },
            {
                "name": "ZBLL L 31",
                "alg": "y' R' F R U R U' R' F' U R U R' U R U' R'"
            },
            {
                "name": "ZBLL L 32",
                "alg": "y R' U' R U2 R' F' R U R' U' R' F R2 U R' U2 R"
            },
            {
                "name": "ZBLL L 33",
                "alg": "y2 F' R U2 R' U2 R' F R U R U' R'"
            },
            {
                "name": "ZBLL L 34",
                "alg": "y R U R' U R' D' R U2 R' D R2 U' R' U R U' R'"
            },
            {
                "name": "ZBLL L 35",
                "alg": "R' U' R' D' R U2 R' D R U R U' R' U' R"
            },
            {
                "name": "ZBLL L 36",
                "alg": "y' F R U' R' U' R U2 R' U' F'"
            },
            {
                "name": "ZBLL L 37",
                "alg": "y2 R U R' U R U2 R D R' U2 R D' R' U2 R'"
            },
            {
                "name": "ZBLL L 38",
                "alg": "y2 R U2 R' U' R2 D R' U' R D' R2"
            },
            {
                "name": "ZBLL L 39",
                "alg": "R' D' R U2 R' D R U R U2 R' U R U R'"
            },
            {
                "name": "ZBLL L 40",
                "alg": "R' F' R U R' U' R' F R2 U' R' U2 R"
            },
            {
                "name": "ZBLL L 41",
                "alg": "y R U2 R D R' U2 R D' R2"
            },
            {
                "name": "ZBLL L 42",
                "alg": "y R U2 R' U2 R U R2 D' R U2 R' D R2 U2 R'"
            },
            {
                "name": "ZBLL L 43",
                "alg": "y2 F R U R' U' R' F' U' R U R U' R' U' R' U R"
            },
            {
                "name": "ZBLL L 44",
                "alg": "y2 R U R' U R U R' U2 R' D' r U2 r' D R"
            },
            {
                "name": "ZBLL L 45",
                "alg": "y R U' R2 D' R U' R' D R U2 R U' R' U' R U R'"
            },
            {
                "name": "ZBLL L 46",
                "alg": "y2 R' F' R U2 R U2 R' F U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL L 47",
                "alg": "y R' U R U2 R' U' R U2 R' U' R U' R2 D' R U R' D R2"
            },
            {
                "name": "ZBLL L 48",
                "alg": "y' R' F' R U R' U' R' F D' R U' R' D R2 U R' U R"
            },
            {
                "name": "ZBLL L 49",
                "alg": "y r U2 r2 F R F' r2 R' U2 r'"
            },
            {
                "name": "ZBLL L 50",
                "alg": "y R U' R' U R U' R' U' R U R' U2 R' D' R U R' D R"
            },
            {
                "name": "ZBLL L 51",
                "alg": "R' U R U' R' U R U R' U' R U2 R D R' U' R D' R'"
            },
            {
                "name": "ZBLL L 52",
                "alg": "r U2 R r2 F R' F' r2 U2 r'"
            },
            {
                "name": "ZBLL L 53",
                "alg": "y2 F' r U R' U R' D R U' R' D' R U' r' F R"
            },
            {
                "name": "ZBLL L 54",
                "alg": "r U R2 D' R U2 R' D R U r' F R F'"
            },
            {
                "name": "ZBLL L 55",
                "alg": "y R' U R U' R' U' R U' R' U2 R' D' R U' R' D R2"
            },
            {
                "name": "ZBLL L 56",
                "alg": "y2 B' R U R' U' R' F R2 U' R' U' R U R' S z'"
            },
            {
                "name": "ZBLL L 57",
                "alg": "y' R' U' R U R' F' R U R' U' R' F R2"
            },
            {
                "name": "ZBLL L 58",
                "alg": "y F R U R2 F R F' R U' R' F'"
            },
            {
                "name": "ZBLL L 59",
                "alg": "y' L' U2 R U' R' U2 L R U' R'"
            },
            {
                "name": "ZBLL L 60",
                "alg": "y2 R U R' U F' R U2 R' U' R' U' R' F R U R"
            },
            {
                "name": "ZBLL L 61",
                "alg": "y' R2 U R' U R' U' R U' R' U' R U R U' R2"
            },
            {
                "name": "ZBLL L 62",
                "alg": "y R U2 R' U' R U' R' U R' U2 R U R' U R"
            },
            {
                "name": "ZBLL L 63",
                "alg": "y R U R' U R U2 R' U R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL L 64",
                "alg": "y R2 U' R U R U' R' U' R U' R' U R' U R2"
            },
            {
                "name": "ZBLL L 65",
                "alg": "R' U2 R U R' U R U' R U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL L 66",
                "alg": "y2 R2 U' R U' R U R' U R U R' U' R' U R2"
            },
            {
                "name": "ZBLL L 67",
                "alg": "R' U' R U' R' U2 R U' R U R' U R U2 R'"
            },
            {
                "name": "ZBLL L 68",
                "alg": "R2 U R' U' R' U R U R' U R U' R U' R2"
            },
            {
                "name": "ZBLL L 69",
                "alg": "y R U2 R' U' R U' R' U2 R U R' U R U2 R'"
            },
            {
                "name": "ZBLL L 70",
                "alg": "y R U R' U R U2 R' U2 R U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL L 71",
                "alg": "y' R U R' U R U' R' U R U' R' U R U2 R'"
            },
            {
                "name": "ZBLL L 72",
                "alg": "R U R' U R U' R' U R U2 R' U' R U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL H 1",
                "alg": "y F' r U R' U' r' F R2 U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL H 2",
                "alg": "y' F R' F' r U R U' r2 F2 r U L' U L"
            },
            {
                "name": "ZBLL H 3",
                "alg": "y' R U2 R' U' R U R' U2 R' F R2 U' R' U' R U R' F'"
            },
            {
                "name": "ZBLL H 4",
                "alg": "y F' R U2 R' U2 R' F U' R U R U' R' U' R' U R"
            },
            {
                "name": "ZBLL H 5",
                "alg": "y2 R' U2 R2 U R2 U R U2 R' F R U R U' R' F'"
            },
            {
                "name": "ZBLL H 6",
                "alg": "y' R U2 R' U' R U R' U' F' R U R' U' R' F R2 U' R'"
            },
            {
                "name": "ZBLL H 7",
                "alg": "R U R' U R U' R2 F' R U2 R U2 R' F R U' R'"
            },
            {
                "name": "ZBLL H 8",
                "alg": "y2 F R U' R' U R U2 R' U' R U R' U' F'"
            },
            {
                "name": "ZBLL H 9",
                "alg": "y2 F R' F' R2 U2 R' U R U2 R' U R U' R2 F R F'"
            },
            {
                "name": "ZBLL H 10",
                "alg": "y' R' U2 R U2 R2 F' R U R U' R' F U R"
            },
            {
                "name": "ZBLL H 11",
                "alg": "y F' R U2 R' U2 R' F R U R U R' U' R U' R'"
            },
            {
                "name": "ZBLL H 12",
                "alg": "F U' R U2 R' U2 R U' R' U' R U R' U F'"
            },
            {
                "name": "ZBLL H 13",
                "alg": "y' R' U2 R U R' U' F' R U R' U' R' F R U2 R"
            },
            {
                "name": "ZBLL H 14",
                "alg": "y' R U2 R' U' R2 D R' U R D' R2 U' R U' R'"
            },
            {
                "name": "ZBLL H 15",
                "alg": "y2 R2 D' R U' R' D R2 U' R2 D' R U2 R' D R2"
            },
            {
                "name": "ZBLL H 16",
                "alg": "y R' U2 R U R2 D' R U' R' D R2 U R' U R"
            },
            {
                "name": "ZBLL H 17",
                "alg": "F R' F' R U2 R U2 R' U' R' F2 r U r' F R"
            },
            {
                "name": "ZBLL H 18",
                "alg": "y2 R' U' R U' R' U F' R U R' U' R' F R2 U' R' U R"
            },
            {
                "name": "ZBLL H 19",
                "alg": "y' F R U' R' U' R U2 R' U' F' U R U R' U R U2 R'"
            },
            {
                "name": "ZBLL H 20",
                "alg": "y R U R' U R U2 R' F R U' R' U' R U2 R' U' F'"
            },
            {
                "name": "ZBLL H 21",
                "alg": "R' F' R U2 R U2 R' F U' R U' R'"
            },
            {
                "name": "ZBLL H 22",
                "alg": "R U R' U R U r' F R' F' r"
            },
            {
                "name": "ZBLL H 23",
                "alg": "y R' F R' F' R2 U' r' U r U' r' U' r"
            },
            {
                "name": "ZBLL H 24",
                "alg": "y' R U R2 F R F' r U' r' U r U r'"
            },
            {
                "name": "ZBLL H 25",
                "alg": "F U' R2 U R U2 R' U R2 U2 R' U' R F'"
            },
            {
                "name": "ZBLL H 26",
                "alg": "y R U' R2 U' F2 U' R2 U R2 U F2 R2 U R'"
            },
            {
                "name": "ZBLL H 27",
                "alg": "y F R U R' U' R U R' U' R U R' U' F'"
            },
            {
                "name": "ZBLL H 28",
                "alg": "x' U' R U' R' U R' F2 R U' R U R' U x"
            },
            {
                "name": "ZBLL H 29",
                "alg": "R' U2 R U R' U R U R' U' R U R' F' R U R' U' R' F R2"
            },
            {
                "name": "ZBLL H 30",
                "alg": "R' U' R U' R' U2 R2 U2 L' U R' U' L U' R U' R'"
            },
            {
                "name": "ZBLL H 31",
                "alg": "R' U' F' U F R U' F U R U' R' U R U' R' F'"
            },
            {
                "name": "ZBLL H 32",
                "alg": "y' R U R' U y' R' U R U' R2 F R F' R"
            },
            {
                "name": "ZBLL H 33",
                "alg": "R U R' U R U' R' U R U2 R'"
            },
            {
                "name": "ZBLL H 34",
                "alg": "R' U' R U' R' U R U' R' U2 R"
            },
            {
                "name": "ZBLL H 35",
                "alg": "y' R' U2 R U R' U' R U R' U R"
            },
            {
                "name": "ZBLL H 36",
                "alg": "y' R U2 R' U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL H 37",
                "alg": "y' R' U2 R U R' U R U R U R' U R U2 R'"
            },
            {
                "name": "ZBLL H 38",
                "alg": "y R U2 R' U' R U' R' U' R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL H 39",
                "alg": "R U R' U R U2 R' U' R' U2 R U R' U R"
            },
            {
                "name": "ZBLL H 40",
                "alg": "R U R' U R U' R' U R U' R' U R' U' R2 U' R' U R' U R"
            },
            {
                "name": "ZBLL S 1",
                "alg": "y2 R' U2 R U F R' U R U' F'"
            },
            {
                "name": "ZBLL S 2",
                "alg": "R U R' U R U' R2 F' R U R U' R' F R U' R'"
            },
            {
                "name": "ZBLL S 3",
                "alg": "R' U R U2 R' U R2 D R' U R D' R'"
            },
            {
                "name": "ZBLL S 4",
                "alg": "y2 S' U2 L' U2 L U2 L F' L' f"
            },
            {
                "name": "ZBLL S 5",
                "alg": "y R' F R U R' U' R' F' D' R U R' D R2"
            },
            {
                "name": "ZBLL S 6",
                "alg": "F' R U R' U R U2 R' F U R U' R' U2 R U' R'"
            },
            {
                "name": "ZBLL S 7",
                "alg": "y' R' U' R U R2 U' R' U' R U D' R U R' D R'"
            },
            {
                "name": "ZBLL S 8",
                "alg": "y2 R U R' U R2 D r' U2 r D' R2"
            },
            {
                "name": "ZBLL S 9",
                "alg": "y R U R' U' R U R2 D' R U R' D R U R U2 R'"
            },
            {
                "name": "ZBLL S 10",
                "alg": "y2 R U R' U R2 D R' U2 R D' R2"
            },
            {
                "name": "ZBLL S 11",
                "alg": "y' R' D' R U2 R' D R U' R U R' U2 R U R'"
            },
            {
                "name": "ZBLL S 12",
                "alg": "R U2 R D R' U2 R D' R' U R' U R U2 R'"
            },
            {
                "name": "ZBLL S 13",
                "alg": "R U R' U' R2 U' L' U R2 U' L U' R U2 R'"
            },
            {
                "name": "ZBLL S 14",
                "alg": "R U R' U R' F R F' R U' R' F' U F R U' R'"
            },
            {
                "name": "ZBLL S 15",
                "alg": "y R' U' F2 U' R2 U R2 U F2 R2 U2 R'"
            },
            {
                "name": "ZBLL S 16",
                "alg": "y2 R U2 R' U' R U R' U' R U R D R' U2 R D' R2"
            },
            {
                "name": "ZBLL S 17",
                "alg": "y' F R' U R U F' R' U F U F' R"
            },
            {
                "name": "ZBLL S 18",
                "alg": "y' F R' U2 R F' R' F U2 F' R"
            },
            {
                "name": "ZBLL S 19",
                "alg": "y' R U R' U R U' R D R' U R r' U2 r D' R2"
            },
            {
                "name": "ZBLL S 20",
                "alg": "R U' R' U' R U R D R' U2 R D' R2 U R U2 R'"
            },
            {
                "name": "ZBLL S 21",
                "alg": "y' R' U2 R' D' R U R' D R U' R U R' U R"
            },
            {
                "name": "ZBLL S 22",
                "alg": "y2 R U R' U R U' R D R' U R D' R' U2 R'"
            },
            {
                "name": "ZBLL S 23",
                "alg": "y' R U R' U R U' R D R' U' R D' R2"
            },
            {
                "name": "ZBLL S 24",
                "alg": "y2 R2 D' R U' R' D R U' R U R' U R"
            },
            {
                "name": "ZBLL S 25",
                "alg": "R2 D R' U2 R D' R' U' R' U R U2 R'"
            },
            {
                "name": "ZBLL S 26",
                "alg": "y' R' U2 F' R U R' U' R' F R U2 R"
            },
            {
                "name": "ZBLL S 27",
                "alg": "y R' U2 R U R' U' R' D' R U2 R' D R2"
            },
            {
                "name": "ZBLL S 28",
                "alg": "y R U R' U R U' R2 D' R U R' D R2 U2 R'"
            },
            {
                "name": "ZBLL S 29",
                "alg": "R U' L' U R' U' L"
            },
            {
                "name": "ZBLL S 30",
                "alg": "y' R' U2 R2 U R D' R U R' D R2 U' R U' R'"
            },
            {
                "name": "ZBLL S 31",
                "alg": "y' R U R' U R U2 R2 U R U2 L' R' U R U' L"
            },
            {
                "name": "ZBLL S 32",
                "alg": "y2 R U R' F' R U R' U R U' R' U' R' F R2 U' R'"
            },
            {
                "name": "ZBLL S 33",
                "alg": "y R' U' R' U R2 D' U2 R U R' U' D R'"
            },
            {
                "name": "ZBLL S 34",
                "alg": "y2 L U' R' U L' R' U' R' U' R' U R U R2"
            },
            {
                "name": "ZBLL S 35",
                "alg": "R2 D r' U2 r D' R' U' R' U R U2 R'"
            },
            {
                "name": "ZBLL S 36",
                "alg": "y' R' U' D R' U R D' U2 R2 U R' U' R'"
            },
            {
                "name": "ZBLL S 37",
                "alg": "L' R U R' U' L U2 R U2 R'"
            },
            {
                "name": "ZBLL S 38",
                "alg": "y R' D' R U R' D R2 U R' U2 R U R'"
            },
            {
                "name": "ZBLL S 39",
                "alg": "y R' U2 R U R2 D' R U' R' D R U2 R"
            },
            {
                "name": "ZBLL S 40",
                "alg": "f R' F' R U2 R U2 R' U2 S'"
            },
            {
                "name": "ZBLL S 41",
                "alg": "y R U' L' U R' U2 L U R U' L' U R' L"
            },
            {
                "name": "ZBLL S 42",
                "alg": "R' F' R U R U R' U' R U' R' F R U R' U R U' R'"
            },
            {
                "name": "ZBLL S 43",
                "alg": "y2 R2 D' r U2 r' D R2 U R' U R"
            },
            {
                "name": "ZBLL S 44",
                "alg": "F U R U' R' S R' F' R U R U' R' S'"
            },
            {
                "name": "ZBLL S 45",
                "alg": "F R U R' U' R' F' R U2 R U' R' U R U2 R'"
            },
            {
                "name": "ZBLL S 46",
                "alg": "R' U2 R U R' U R' D' R U2 R' D R U2 R"
            },
            {
                "name": "ZBLL S 47",
                "alg": "R2 F R U R U' R' F' R U' R' U R"
            },
            {
                "name": "ZBLL S 48",
                "alg": "y2 R2 D' R U2 R' D R2 U R' U R"
            },
            {
                "name": "ZBLL S 49",
                "alg": "y R2 U R2 F' R U2 R' U' R U' R' F R2 U' R2"
            },
            {
                "name": "ZBLL S 50",
                "alg": "y F U R' F R F' R U' R' U R U' R' F'"
            },
            {
                "name": "ZBLL S 51",
                "alg": "y' R U' R2 U2 D' R U R' U D R2 U R'"
            },
            {
                "name": "ZBLL S 52",
                "alg": "y F' R U R' D R U R' U' D' R U' R' F"
            },
            {
                "name": "ZBLL S 53",
                "alg": "y' R' U2 R2 U R' F' R U R' U' R' F R2 U' R2 U R"
            },
            {
                "name": "ZBLL S 54",
                "alg": "F R U R' U R U2 R U2 R2 U' R2 U' R2 F'"
            },
            {
                "name": "ZBLL S 55",
                "alg": "R' U2 R U R' U' R F U' R' U' R U F'"
            },
            {
                "name": "ZBLL S 56",
                "alg": "L' U2 R U' R' U2 L U R U' R' U R U2 R'"
            },
            {
                "name": "ZBLL S 57",
                "alg": "y2 R U R' U L' U R U' L U2 R'"
            },
            {
                "name": "ZBLL S 58",
                "alg": "F U' R' U R U F' R U R2 U R2 U2 R'"
            },
            {
                "name": "ZBLL S 59",
                "alg": "R' U2 L U' R U L' U R' U R"
            },
            {
                "name": "ZBLL S 60",
                "alg": "F R U' R2 U2 R U R' U R2 U R' F'"
            },
            {
                "name": "ZBLL S 61",
                "alg": "y' R U R' U' R' U2 R U R' U R U' R U' R'"
            },
            {
                "name": "ZBLL S 62",
                "alg": "R U R' U R U' R' U R' U' R2 U' R' U R' U R"
            },
            {
                "name": "ZBLL S 63",
                "alg": "R U R2 U' R2 U' R2 U2 R2 U2 R'"
            },
            {
                "name": "ZBLL S 64",
                "alg": "y' R' U2 R U R' U R"
            },
            {
                "name": "ZBLL S 65",
                "alg": "R U R' U R U R U R U R U' R' U' R2"
            },
            {
                "name": "ZBLL S 66",
                "alg": "R U R2 F' R U2 R U' R' U' R' F R2 U' R'"
            },
            {
                "name": "ZBLL S 67",
                "alg": "R U R' U R U2 R'"
            },
            {
                "name": "ZBLL S 68",
                "alg": "R' U2 R2 U2 R2 U' R2 U' R2 U R"
            },
            {
                "name": "ZBLL S 69",
                "alg": "y' R U R' U' R' U2 R U R U' R' U R' U R"
            },
            {
                "name": "ZBLL S 70",
                "alg": "y' R' U' R U R U R' U' R' U R U R U' R'"
            },
            {
                "name": "ZBLL S 71",
                "alg": "y' R' U2 R2 U R2 U R U' R U' R'"
            },
            {
                "name": "ZBLL S 72",
                "alg": "R U R' U' R U R' U R U R U2 R' U' R U' R' U R'"
            },
            {
                "name": "ZBLL AS 1",
                "alg": "y' R2 D R' U2 R D' R' U' R' U R U' R' U R U2 R'"
            },
            {
                "name": "ZBLL AS 2",
                "alg": "y2 R' U2 F' R U R' U' R' F R2 U R' U R"
            },
            {
                "name": "ZBLL AS 3",
                "alg": "y2 R' U R U R' U R U2 R' U' R2 D R' U2 R D' R'"
            },
            {
                "name": "ZBLL AS 4",
                "alg": "y' R' D' R U2 R' D R2 U' R' U2 R U R' U R U R'"
            },
            {
                "name": "ZBLL AS 5",
                "alg": "y2 R' F U2 F' R F R' U2 R F'"
            },
            {
                "name": "ZBLL AS 6",
                "alg": "y2 R' F U' F' U' R F U' R' U' R F'"
            },
            {
                "name": "ZBLL AS 7",
                "alg": "y2 R2 D r' U2 r R' U' R D' R' U R' U' R U' R'"
            },
            {
                "name": "ZBLL AS 8",
                "alg": "y' R U2 R' U' R2 D R' U2 R D' R' U' R' U R U R'"
            },
            {
                "name": "ZBLL AS 9",
                "alg": "y2 R' U' R U' R D R' U' R D' R' U R' U2 R"
            },
            {
                "name": "ZBLL AS 10",
                "alg": "y R U2 R D R' U' R D' R' U R' U' R U' R'"
            },
            {
                "name": "ZBLL AS 11",
                "alg": "y2 R2 D R' U R D' R' U R' U' R U' R'"
            },
            {
                "name": "ZBLL AS 12",
                "alg": "y R' U' R U' R' U R' D' R U R' D R2"
            },
            {
                "name": "ZBLL AS 13",
                "alg": "R U' R' U2 R U' R2 D' R U' R' D R"
            },
            {
                "name": "ZBLL AS 14",
                "alg": "S U2 R U2 R' U2 R' F R f'"
            },
            {
                "name": "ZBLL AS 15",
                "alg": "y2 R U2 R' U2 L' U R U' R' L"
            },
            {
                "name": "ZBLL AS 16",
                "alg": "y' R' U2 R' D' R U R' D R2 U' R' U2 R"
            },
            {
                "name": "ZBLL AS 17",
                "alg": "y R U R' U' R U' R' F' R U R' U R U' R' U' R' F R"
            },
            {
                "name": "ZBLL AS 18",
                "alg": "y R2 D R' U R D' R2 U' r' F R F' M'"
            },
            {
                "name": "ZBLL AS 19",
                "alg": "y2 S R U R' U' R' F R S' R U R' U' F'"
            },
            {
                "name": "ZBLL AS 20",
                "alg": "y2 R' U' R U' R2 D' r U2 r' D R2"
            },
            {
                "name": "ZBLL AS 21",
                "alg": "y2 R' U' R U' R2 D' R U2 R' D R2"
            },
            {
                "name": "ZBLL AS 22",
                "alg": "y2 R U2 R' U' R U R' U2 R' F R U R U' R' F'"
            },
            {
                "name": "ZBLL AS 23",
                "alg": "R' U2 R' D' R U2 R' D R U' R U' R' U2 R"
            },
            {
                "name": "ZBLL AS 24",
                "alg": "R' U' R U R' F R U R' U' R' F' R2"
            },
            {
                "name": "ZBLL AS 25",
                "alg": "y' R U2 R' U' R U R D R' U2 R D' R2"
            },
            {
                "name": "ZBLL AS 26",
                "alg": "y2 R' U2 R' F' R U R U' R' F U2 R"
            },
            {
                "name": "ZBLL AS 27",
                "alg": "R2 D' R U2 R' D R U R U' R' U2 R"
            },
            {
                "name": "ZBLL AS 28",
                "alg": "y2 F U R U' R' U R U' R2 F' R U2 R U2 R'"
            },
            {
                "name": "ZBLL AS 29",
                "alg": "y F U R U' R' U R U' R' U R2 D R' U' R D' R2 F'"
            },
            {
                "name": "ZBLL AS 30",
                "alg": "y2 L' U R U' L U R'"
            },
            {
                "name": "ZBLL AS 31",
                "alg": "y2 R' U R U R' U' R' D' R U R' D R U R U' R' U2 R"
            },
            {
                "name": "ZBLL AS 32",
                "alg": "y R U R2 F' R U R U R' U' R U' R' F R U' R'"
            },
            {
                "name": "ZBLL AS 33",
                "alg": "y' R U2 R' U' R U R D r' U2 r D' R2"
            },
            {
                "name": "ZBLL AS 34",
                "alg": "y' R U R U' R2 D U2 R' U' R U D' R"
            },
            {
                "name": "ZBLL AS 35",
                "alg": "y R D' U R U' R' U2 D R2 U' R U R"
            },
            {
                "name": "ZBLL AS 36",
                "alg": "R2 D' r U2 r' D R U R U' R' U2 R"
            },
            {
                "name": "ZBLL AS 37",
                "alg": "R U R' F' R U R' U' R' F R2 U R' U' R U' R'"
            },
            {
                "name": "ZBLL AS 38",
                "alg": "y2 f' L F L' U2 L' U2 L U2 S"
            },
            {
                "name": "ZBLL AS 39",
                "alg": "y' F U R' U' R F' U' R' U2 R"
            },
            {
                "name": "ZBLL AS 40",
                "alg": "R' U' F' R U R' U' R' F R2 U' R' U R"
            },
            {
                "name": "ZBLL AS 41",
                "alg": "y R U R' U2 R U R' U' F' R U2 R' U' R U' R' F"
            },
            {
                "name": "ZBLL AS 42",
                "alg": "R2 D' R U' R' D F R U R U' R' F' R"
            },
            {
                "name": "ZBLL AS 43",
                "alg": "y2 R2 D r' U2 r D' R2 U' R U' R'"
            },
            {
                "name": "ZBLL AS 44",
                "alg": "y R U R' U R U' R2 F R F' r U' r' U r U r'"
            },
            {
                "name": "ZBLL AS 45",
                "alg": "R U2 R' U' R U' R D R' U2 R D' R' U2 R'"
            },
            {
                "name": "ZBLL AS 46",
                "alg": "R U2 R' U' R' D' R U' R' D R2 U' R' U R U' R'"
            },
            {
                "name": "ZBLL AS 47",
                "alg": "y2 R2 D R' U2 R D' R2 U' R U' R'"
            },
            {
                "name": "ZBLL AS 48",
                "alg": "R U' R' U2 R U' R' U R' D' R U2 R' D R"
            },
            {
                "name": "ZBLL AS 49",
                "alg": "y R U' R' F' R U R' U' R' F R2 U' R' U2 R U' R'"
            },
            {
                "name": "ZBLL AS 50",
                "alg": "y' R U2 R2 U' R2 U' R' F U' R' U' R U F'"
            },
            {
                "name": "ZBLL AS 51",
                "alg": "R U R' F' R U2 R' U' R U' R' F R U' R'"
            },
            {
                "name": "ZBLL AS 52",
                "alg": "y2 R' U' R U' L U' R' U L' U2 R"
            },
            {
                "name": "ZBLL AS 53",
                "alg": "y2 F R' F' R U R U' R2 F R U R' U' F' U R"
            },
            {
                "name": "ZBLL AS 54",
                "alg": "y2 F R2 U R2 U R2 U2 R' U2 R' U' R U' R' F'"
            },
            {
                "name": "ZBLL AS 55",
                "alg": "y' F U' R' U R U F' R' U R U' R' U2 R"
            },
            {
                "name": "ZBLL AS 56",
                "alg": "y' F R U' R' U R U2 R' U' F' R U R' U' R' F R F'"
            },
            {
                "name": "ZBLL AS 57",
                "alg": "y' R2 U R2 F' R U R' U R U2 R' F R2 U' R2"
            },
            {
                "name": "ZBLL AS 58",
                "alg": "y' F R U R' U' R U R' F R' F' R U' F'"
            },
            {
                "name": "ZBLL AS 59",
                "alg": "y2 R' U F' R U R' U' R' F R U2 R U2 R' U' R"
            },
            {
                "name": "ZBLL AS 60",
                "alg": "y' R U' R2 D' U' R U' R' U2 D R2 U R'"
            },
            {
                "name": "ZBLL AS 61",
                "alg": "y R2 U R2 U R' U2 R' U R U R' U' R2"
            },
            {
                "name": "ZBLL AS 62",
                "alg": "y R' U' R U R U2 R' U' R U' R' U R' U R"
            },
            {
                "name": "ZBLL AS 63",
                "alg": "y2 R U R' U R' U' R U' R' U2 R U R U' R'"
            },
            {
                "name": "ZBLL AS 64",
                "alg": "y' R' U' R U' R U R2 U R U' R U R' U' R U' R'"
            },
            {
                "name": "ZBLL AS 65",
                "alg": "R' U' R2 U R2 U R2 U2 R2 U2 R"
            },
            {
                "name": "ZBLL AS 66",
                "alg": "y R U2 R' U' R U' R'"
            },
            {
                "name": "ZBLL AS 67",
                "alg": "R U2 R2 U2 R2 U R2 U R2 U' R'"
            },
            {
                "name": "ZBLL AS 68",
                "alg": "R' U' R U' R' U2 R"
            },
            {
                "name": "ZBLL AS 69",
                "alg": "y R U R' U' R' U' R U R U' R' U' R' U R"
            },
            {
                "name": "ZBLL AS 70",
                "alg": "y R' U' R U R U2 R' U' R' U R U' R U' R'"
            },
            {
                "name": "ZBLL AS 71",
                "alg": "y2 R U R' U R' U' R2 U' R2 U2 R"
            },
            {
                "name": "ZBLL AS 72",
                "alg": "y' R2 D' R U2 R' D R U R' F R U R U' R' F' R"
            }
        ]
    },
    "4x4": {
        "OLL Parity": [
            {
                "name": "Basic",
                "alg": "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"
            },
            {
                "name": "Pure",
                "alg": "2R' U2 2L F2 2L' F2 2R2 U2 2R U2 2R' U2 F2 2R2 F2"
            },
            {
                "name": "M",
                "alg": "M Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' M'"
            }
        ],
        "PLL Parity": [
            {
                "name": "OPP Parity",
                "alg": "2R2 U2 2R2 Uw2 2R2 Uw2"
            },
            {
                "name": "Adj Parity",
                "alg": "R' U R U' 2R2 U2' 2R2 Uw2' 2R2 Uw2' U' R' U' R"
            },
            {
                "name": "CwO",
                "alg": "M2 U' M2 U' M' U2 M2 U2 M' Parity Alg (2R2)M2 U' M2 U' M' U2 M2 U2 M' 2R2 U2 2R2 Uw2 2R2 Uw2"
            },
            {
                "name": "CcwO",
                "alg": "Uw2 2L2 Uw2 2L2 U2 3Rw' Rw2 R' U2 M2 U2 M' U M2 U M2"
            },
            {
                "name": "W",
                "alg": "R' U R' U' R' U' R' U R U Rw2 U2 2R2 Uw2 2R2 Uw2"
            },
            {
                "name": "Pj",
                "alg": "R U R' U' R' F R2 U' R' U' R U R' F' U' 2L2 U2 2L2 Uw2 2L2 Uw2"
            },
            {
                "name": "Ba",
                "alg": "Uw2 2L2 Uw2 2L2 U2 2L2 U R U R' F' R U R' U' R' F R2 U' R'"
            },
            {
                "name": "Bb",
                "alg": "y x Rw2 U2 Rw2 Uw2 2R2 Uw2 B 3Rw' U R' U2 L U' R"
            },
            {
                "name": "Ca",
                "alg": "y2 Uw2 2R2 Uw2 2R2 U2 Rw2 F R U R U' R' F' R U2 R' U2 R"
            },
            {
                "name": "Cb",
                "alg": "y R' U2 R U2 R' F R U R' U' R' F' Rw2 U2 2R2 Uw2 2R2 Uw2"
            },
            {
                "name": "Da",
                "alg": "R' U L' U2 R U' 3Rw B Rw2 U2 Rw2 Uw2 2R2 Uw2 x'"
            },
            {
                "name": "Db",
                "alg": "R U R' F' R U R' U' R' F R2 U' R' u2 2R2 u2 2R2 U2 2R2"
            },
            {
                "name": "Ka",
                "alg": "y 3Lw' U R' D2 R U' R' D2 x' Rw2 U2 2R2 Uw2 2R2 Uw2"
            },
            {
                "name": "Kb",
                "alg": "r2 F2 U2 r2 R2 U2 x R' D' R U2 R' D R r2 x' U'"
            },
            {
                "name": "M",
                "alg": "y2 Rw2 F2 U2 2R2 U R' U' R U R' D R D' R F2 U Rw2"
            },
            {
                "name": "Pa",
                "alg": "R U R' F' R U R' U' R' F R2 U' R' U' 2R2 U2 2R2 u2 2R2 u2"
            },
            {
                "name": "Pb",
                "alg": "2R2 U2 2R2 u2 2R2 u2 R U R' F' R U R' U' R' F R2 U' R'"
            },
            {
                "name": "Diag C",
                "alg": "F R U' R' U' R U R' F' U' 2R2 U2 2R2 u2 2R2 u2 U' R U R' U' R' F R F'"
            },
            {
                "name": "Q",
                "alg": "z Rw2 Uw2' R2' Uw2' F R U R' U' R U R' U' R U R' U' F' U2' R2 Uw2' Rw2' z'"
            },
            {
                "name": "Sa",
                "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F' U' 2R2 U2 2R2 u2 2R2 u2"
            },
            {
                "name": "Sb",
                "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F' 2R2 U2 2R2 u2 2R2 u2"
            },
            {
                "name": "X",
                "alg": "Rw2 F2 U2 Rw2 F' U' R' U R U' R' U R U' R' U R F R2 U2 F2 Rw2"
            }
        ]
    },
    "5x5": {
        "L2E": [
            {
                "name": "L2E 1",
                "alg": "Rw' U' R' U R' F R F' Rw"
            },
            {
                "name": "L2E 2",
                "alg": "Lw U' R' U R' F R F' Lw'"
            },
            {
                "name": "L2E 3",
                "alg": "x' M' U' R' U R' F R F' M x"
            },
            {
                "name": "L2E 4",
                "alg": "Rw2 F2 U2 Rw2 U2 F2 Rw2"
            },
            {
                "name": "L2E 5",
                "alg": "Rw2 B2 Rw' U2 Rw' U2' x' U2 Rw' U2' Rw U2 Rw' U2' Rw2 U2 x"
            },
            {
                "name": "L2E 6",
                "alg": "Rw' U2 3Rw U2 3Rw' F2 Rw2 U2 Rw U2 Rw' U2 F2 Rw2 F2"
            },
            {
                "name": "L2E 7",
                "alg": "y2 Rw U2 Rw U2' x U2 Rw U2' 3Rw' U2 Lw U2' Rw2"
            },
            {
                "name": "L2E 8",
                "alg": "Lw2 F2 U2 Lw' U2 Lw2 F2 Lw' U2 Lw2 U2 F2 Lw' F2"
            },
            {
                "name": "L2E 9",
                "alg": "B2 Rw' U2 Rw' U2' Rw B2 Rw U2 Rw U2' Rw' U2 Rw U2' Rw2"
            },
            {
                "name": "L2E 10",
                "alg": "Rw' U2 Rw2 U2 Rw U2 Rw' U2 Rw U2 Rw2 U2 Rw'"
            },
            {
                "name": "L2E 11",
                "alg": "Rw U2 Rw2 U2 Rw' U2 Rw U2 Rw' U2 Rw2 U2 Rw"
            },
            {
                "name": "L2E 12",
                "alg": "Rw' U2 Rw U2 3Lw' U2 Rw U2 Rw U2' Rw' U2 Rw U2' Rw2 D2 F2 U2 D2"
            },
            {
                "name": "L2E 13",
                "alg": "r U R' U' r2 U' R' U r2 U R' U' r'"
            }
        ]
    },
    "Pyraminx": {
        "L4E": {
            "Last Layer": [
                { "name": "Sune", "alg": "R U R' U R U R'", "setup": "L' U' L U' L' U' L" },
                { "name": "AntiSune", "alg": "R U' R' U' R U' R'", "setup": "R U R' U R U R'" },
                { "name": "Lefty Bars", "alg": "R' U' L' U L R", "setup": "R' L' U' L U R" },
                { "name": "Righty Bars", "alg": "L U R U' R' L'", "setup": "L R U R' U' L'" }
            ],
            "L3E": [
                { "name": "Sledge", "alg": "R' L R L'", "setup": "L R' L' R" },
                { "name": "Hedge", "alg": "L R' L' R", "setup": "R' L R L'" },
                { "name": "Clockwise", "alg": "L R' L' R2 U' R'", "setup": "L' U L U R U R'" },
                { "name": "Counterclockwise", "alg": "R' L R L2' U L", "setup": "R U' R' U' L' U' L" },
                { "name": "Righty", "alg": "R U' R'", "setup": "U' R U R'" },
                { "name": "Lefty", "alg": "L' U L", "setup": "U L' U' L" },
                { "name": "Sexy", "alg": "U' R U R'", "setup": "R U' R' U" },
                { "name": "Left Sexy", "alg": "U L' U' L", "setup": "L' U L U'" }
            ],
            "Flipped Edges": [
                { "name": "2 Flip", "alg": "R' L R L' U L' U' L", "setup": "U' R' U L' U L U' R" },
                { "name": "DR Flip", "alg": "L' U L U' R U' R'", "setup": "U' R U R' U L' U' L" },
                { "name": "DL Flip", "alg": "R' L R L' R U' R'", "setup": "U L' U' L U' R U R'" },
                { "name": "DB Flip", "alg": "R U R' U L' U' L", "setup": "U L' U L U' R U' R'" },
                { "name": "4 Flip", "alg": "L' U L R U' R' L' U L R U' R'", "setup": "L' U' L R U R' L' U' L R U R'" }
            ],
            "Polish Flip": [
                { "name": "Right Polish Flip", "alg": "R U' R' L' U' L", "setup": "U L' U L R U R'" },
                { "name": "Left Polish Flip", "alg": "L' U L R U R'", "setup": "U' R U' R' L' U' L" },
                { "name": "SUS", "alg": "R' L R L' U' R' L R L'", "setup": "U' L R' L' R U L R' L' R" },
                { "name": "Anti SUS", "alg": "L R' L' R U L R' L' R", "setup": "U R' L R L' U' R' L R L'" }
            ],
            "Separated Bar": [
                { "name": "Good Niky", "alg": "R U' R' L' U L", "setup": "L' U' L R U R'" },
                { "name": "Good Sochi", "alg": "L' U L R U' R'", "setup": "R U R' L' U' L" },
                { "name": "Super Sledge", "alg": "R U' R2' L R L'", "setup": "U' L R' L' R2 U R'" },
                { "name": "Super Hedge", "alg": "L' U L2' R' L' R", "setup": "R' U' L' U L2 R L'" },
                { "name": "Bad Niky", "alg": "R U' R' U' L' U L", "setup": "U' L' U' L U R U R'" },
                { "name": "Bad Sochi", "alg": "L' U L U R U' R'", "setup": "U R U R' U' L' U' L" }
            ],
            "Connected Bar": [
                { "name": "Right Spam", "alg": "R U R' U R' L R L'", "setup": "R U R' L' U' L R U R' U'" },
                { "name": "Left Spam", "alg": "L' U' L U' L R' L' R", "setup": "L' U' L R U R' L' U' L U" },
                { "name": "Bad Sledge", "alg": "L R' L' R U' R U' R'", "setup": "U R U R' U R' L R L'" },
                { "name": "Bad Hedge", "alg": "R' L R L' U L' U L", "setup": "U' L' U L R U R' L' U L U" }
            ],
            "No Bar": [
                { "name": "Bad Sexy", "alg": "L' U' L U' R U' R'", "setup": "R U R' U L' U L" },
                { "name": "Bad Ugly", "alg": "R U R' U L' U L", "setup": "L' U' L U' R U' R'" },
                { "name": "Bad Righty", "alg": "L' U L U' R U R'", "setup": "U R U' R' U L' U' L" },
                { "name": "Bad Lefty", "alg": "R U' R' U L' U' L", "setup": "U' L' U L U' R U R'" },
                { "name": "Double Sexy", "alg": "R U' R' U' R U R'", "setup": "U' R U' R' U R U R'" },
                { "name": "Double Ugly", "alg": "L' U L U L' U' L", "setup": "U L' U L U' L' U' L" }
            ]
        }
    },
    "Megaminx": {
        "PLL": []
    }
};
