SkinID:
    6 bytes, 6 digits * 1 byte
SkinName:
    64 bytes, 16 digits * 4 bytes (UTF16)
SkinTag:
    8 bytes, 64 bits, each bit 1 for tag at index, 0 for no tag at that index
Favorites:
    2 bytes, (I don't think favorites can go over 65535 lmao)
Timestamp:
    4 bytes, (Date.now() - TIME_0) / 1000, second since TIME_0
OwnerID:
    8 bytes, unsigned long

Total: 92 bytes per skin document in-memory cache