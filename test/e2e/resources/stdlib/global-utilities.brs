sub main()
    node = createObject("roSGNode", "Node")
    print getInterface(1.123, "ifFloat")
    print findMemberFunction({}, "count")
    print findMemberFunction(node, "findNode")
    print FindMemberFunction("", "left")
    print GetInterface("", "ifStringOps")
    print FindMemberFunction(1, "tostr")
    print GetInterface(1, "iftostr")
    di = createObject("roDeviceInfo")
    iface = getInterface(di, "ifDeviceInfo")
    print objFun(di, iface, "getModel")
    print objFun(di, iface, "canDecodeVideo", {codec: "mpeg2"}).result
end sub
