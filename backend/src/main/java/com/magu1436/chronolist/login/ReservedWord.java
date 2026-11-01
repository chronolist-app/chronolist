package com.magu1436.chronolist.login;

public enum ReservedWord {
    ADMIN;

    public static boolean contains(String loginId){
        for (ReservedWord word : values()){
            if (loginId.equals(word.name().toLowerCase())){
                return true;
            }
        }
        return false;
    }
}
